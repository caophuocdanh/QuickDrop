const socket = io();

const roomSelectionDiv = document.getElementById('room-selection');
const roomIdInput = document.getElementById('room-id-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');

const roomInfoDiv = document.getElementById('room-info');
const displayRoomIdSpan = document.getElementById('display-room-id');
const connectionStatusP = document.getElementById('connection-status');

const fileTransferDiv = document.getElementById('file-transfer');
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const transferFilesList = document.getElementById('transfer-files-list');
const transferInfo = document.getElementById('transfer-info');
const transferPercentage = document.getElementById('transfer-percentage');
const transferSize = document.getElementById('transfer-size');
const transferSpeed = document.getElementById('transfer-speed');

let peerConnection;
let dataChannel;
let currentRoomId;
let isInitiator = false;
let isFileTransferInProgress = false; // New: Track file transfer state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let transferStartTime = 0;
let currentSendingFileName = '';

// Global variables for overall batch progress
let currentBatchId = null;
let totalFilesInBatch = 0;
let filesReceivedInBatch = 0;
let totalBytesInBatch = 0;
let bytesTransferredInBatch = 0;

// Variable to track the file currently being received
let currentReceivingFileId = null;

// Browser compatibility checks and polyfills
function checkBrowserCompatibility() {
    const errors = [];
    
    // WebRTC compatibility
    if (!window.RTCPeerConnection) {
        if (window.webkitRTCPeerConnection) {
            window.RTCPeerConnection = window.webkitRTCPeerConnection;
        } else if (window.mozRTCPeerConnection) {
            window.RTCPeerConnection = window.mozRTCPeerConnection;
        } else {
            errors.push('WebRTC is not supported in this browser');
        }
    }
    
    // WebSocket compatibility
    if (!window.WebSocket && !window.io) {
        errors.push('WebSocket/Socket.IO is not supported');
    }
    
    // File API compatibility
    if (!window.FileReader) {
        errors.push('File API is not supported');
    }
    
    // ArrayBuffer compatibility
    if (!window.ArrayBuffer) {
        errors.push('ArrayBuffer is not supported');
    }
    
    // Blob compatibility
    if (!window.Blob) {
        errors.push('Blob API is not supported');
    }
    
    if (errors.length > 0) {
        alert('Browser compatibility issues:\n' + errors.join('\n') + 
              '\n\nPlease use a modern browser like Chrome 56+, Firefox 44+, Safari 11+, or Edge 79+.');
        return false;
    }
    
    // Add getUserMedia polyfill if needed (for future video chat feature)
    if (!navigator.mediaDevices && navigator.getUserMedia) {
        navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = function(constraints) {
            const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (!getUserMedia) {
                return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
            }
            return new Promise(function(resolve, reject) {
                getUserMedia.call(navigator, constraints, resolve, reject);
            });
        };
    }
    
    return true;
}

// Initialize app with compatibility check
if (!checkBrowserCompatibility()) {
    document.body.innerHTML = '<div style="text-align: center; padding: 50px; color: red;">Browser not supported</div>';
}

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Connection recovery functions
function attemptReconnection() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && currentRoomId) {
        reconnectAttempts++;
        connectionStatusP.textContent = `Connection lost. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
        connectionStatusP.className = 'connection-reconnecting';
        
        setTimeout(() => {
            socket.emit('reconnectToRoom', currentRoomId);
        }, 2000 * reconnectAttempts); // Exponential backoff
    } else {
        connectionStatusP.textContent = 'Connection failed. Please refresh the page.';
        connectionStatusP.className = 'connection-failed';
    }
}

// Enhanced Socket.IO connection handling
socket.on('connect', () => {
    reconnectAttempts = 0;
    connectionStatusP.className = 'connection-success';
    if (currentRoomId) {
        socket.emit('reconnectToRoom', currentRoomId);
    }
});

socket.on('disconnect', () => {
    connectionStatusP.textContent = 'Connection lost. Attempting to reconnect...';
    connectionStatusP.className = 'connection-reconnecting';
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
    enableFileSelection(); // Re-enable if transfer was in progress
    attemptReconnection();
});

// File transfer control functions
function enableFileSelection() {
    isFileTransferInProgress = false;
    fileInput.disabled = false;
    dropArea.classList.remove('disabled');
    dropArea.style.pointerEvents = 'auto';
    dropArea.style.opacity = '1';
    hideTransferProgress();
}

function disableFileSelection() {
    isFileTransferInProgress = true;
    fileInput.disabled = true;
    dropArea.classList.add('disabled');
    dropArea.style.pointerEvents = 'none';
    dropArea.style.opacity = '0.5';
}

function showTransferProgress() {
    transferInfo.classList.remove('hidden');
}

function hideTransferProgress() {
    transferInfo.classList.add('hidden');
    transferPercentage.textContent = '0.00%';
    transferSize.textContent = '0 B / 0 B';
    transferSpeed.textContent = '';
    progressBar.style.width = '0%';
}

function updateTransferProgress(current, total, filename = '') {
    if (total === 0) {
        hideTransferProgress();
        return;
    }
    
    showTransferProgress();
    
    const percentage = Math.min(100, (current / total) * 100);
    const elapsed = (Date.now() - transferStartTime) / 1000; // seconds
    const speed = elapsed > 0 ? current / elapsed : 0;
    
    transferPercentage.textContent = `${percentage.toFixed(2)}%`;
    transferSize.textContent = `${formatBytes(current)} / ${formatBytes(total)}`;
    
    if (speed > 0) {
        transferSpeed.textContent = `${formatBytes(speed)}/s`;
    }
    
    progressBar.style.width = percentage.toFixed(2) + '%';
}

function addTransferFile(filename, size, type, status = 'sending') {
    const listItem = document.createElement('li');
    listItem.className = 'transfer-item';
    
    const iconClass = type === 'upload' ? 'upload' : 'download';
    const iconSymbol = type === 'upload' ? '📤' : '📥';
    
    listItem.innerHTML = `
        <div class="transfer-icon ${iconClass}">${iconSymbol}</div>
        <div class="unified-file-name" title="${filename}">${filename}</div>
        <div class="unified-file-size">${formatBytes(size)}</div>
        <div class="unified-file-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
    `;
    
    listItem.id = `transfer-${type}-${filename}`;
    transferFilesList.appendChild(listItem);
    return listItem;
}

function updateTransferFileStatus(filename, type, status, fileUrl = null) {
    const listItem = document.getElementById(`transfer-${type}-${filename}`);
    if (listItem) {
        const statusElement = listItem.querySelector('.unified-file-status');
        
        if (status === 'received' && fileUrl) {
            statusElement.innerHTML = `
                <a href="${fileUrl}" download="${filename}" class="unified-download-btn" title="Download ${filename}">🢃</a>
            `;
        } else {
            // Add icons for different statuses
            let statusIcon = '';
            switch(status) {
                case 'sending':
                    statusIcon = '📤 ';
                    break;
                case 'sent':
                    statusIcon = '✅ ';
                    break;
                case 'receiving':
                    statusIcon = '📥 ';
                    break;
                default:
                    statusIcon = '';
            }
            
            statusElement.innerHTML = statusIcon + status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `unified-file-status ${status}`;
        }
    }
}

// --- Socket.IO Events ---
socket.on('roomCreated', (roomId) => {
    currentRoomId = roomId;
    isInitiator = true;
    displayRoomInfo(roomId);
    connectionStatusP.textContent = 'Room created. Waiting for another user to join...';
    createPeerConnection();
});

socket.on('roomJoined', (roomId) => {
    currentRoomId = roomId;
    isInitiator = false;
    displayRoomInfo(roomId);
    connectionStatusP.textContent = 'Joined room. Connecting...';
    createPeerConnection();
});

socket.on('roomFull', (roomId) => {
    alert(`Room ${roomId} is full.`);
});

socket.on('roomNotFound', (roomId) => {
    alert(`Room ${roomId} not found.`);
});

socket.on('otherUserJoined', () => {
    connectionStatusP.textContent = 'Another user joined! Establishing connection...';
    if (isInitiator) {
        createOffer();
    }
});

// New reconnection events
socket.on('reconnectedToRoom', (roomId) => {
    connectionStatusP.textContent = 'Reconnected! Re-establishing peer connection...';
    connectionStatusP.className = 'connection-success';
    createPeerConnection();
    if (isInitiator) {
        createOffer();
    }
});

socket.on('userReconnected', () => {
    connectionStatusP.textContent = 'Other user reconnected! Re-establishing connection...';
    connectionStatusP.className = 'connection-success';
    createPeerConnection();
});

socket.on('userDisconnected', () => {
    connectionStatusP.textContent = 'Other user disconnected. Waiting for reconnection...';
    connectionStatusP.className = 'connection-reconnecting';
    enableFileSelection(); // Re-enable file selection if transfer was in progress
});

socket.on('reconnectionFailed', () => {
    connectionStatusP.textContent = 'Reconnection failed. Please refresh the page.';
    connectionStatusP.className = 'connection-failed';
});

socket.on('offer', async (data) => {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { sdp: peerConnection.localDescription, roomId: currentRoomId });
});

socket.on('answer', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
});

socket.on('ice-candidate', async (data) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
        console.error('Error adding received ICE candidate', e);
    }
});

// --- UI Event Listeners ---
createRoomBtn.addEventListener('click', () => {
    const roomId = generateRoomId();
    socket.emit('createRoom', roomId);
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socket.emit('joinRoom', roomId);
    } else {
        alert('Please enter a Room ID to join.');
    }
});

dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
    
    if (isFileTransferInProgress) {
        alert('File transfer in progress. Please wait for current transfer to complete.');
        return;
    }
    
    const files = e.dataTransfer.files;
    if (files.length > 1) {
        alert('Please select only one file at a time.');
        return;
    }
    
    handleFiles(files);
});

dropArea.addEventListener('click', () => {
    if (!isFileTransferInProgress) {
        fileInput.click();
    }
});

fileInput.addEventListener('change', (e) => {
    if (isFileTransferInProgress) {
        alert('File transfer in progress. Please wait for current transfer to complete.');
        return;
    }
    
    const files = e.target.files;
    if (files.length > 1) {
        alert('Please select only one file at a time.');
        return;
    }
    
    handleFiles(files);
});

// --- WebRTC Functions ---
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, roomId: currentRoomId });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state change:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            connectionStatusP.textContent = 'Connected! Ready to transfer files.';
            fileTransferDiv.classList.remove('hidden');
            enableFileSelection();
        } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            connectionStatusP.textContent = 'Connection lost. Please refresh.';
            fileTransferDiv.classList.add('hidden');
            enableFileSelection();
        }
    };

    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel('fileTransfer');
        setupDataChannelEvents(dataChannel);
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannelEvents(dataChannel);
        };
    }
}

async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { sdp: peerConnection.localDescription, roomId: currentRoomId });
}

// --- DataChannel File Transfer Logic ---
const receivedBuffers = {}; // Store file chunks for all files
const receivedFileMetadata = {}; // Stores metadata for all files

const LARGE_FILE_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB

function setupDataChannelEvents(channel) {
    channel.onopen = () => {
        console.log('DataChannel is open!');
        connectionStatusP.textContent = 'Connected! Ready to transfer files.';
        fileTransferDiv.classList.remove('hidden');
        enableFileSelection();
    };

    channel.onmessage = async (event) => {
        const message = event.data;
        // console.log('Received message:', message);

        if (typeof message === 'string') {
            // This is metadata (JSON string)
            try {
                const metadata = JSON.parse(message);
                console.log('Parsed metadata:', metadata);
                if (metadata.type === 'batchMetadata') {
                    currentBatchId = metadata.id;
                    totalFilesInBatch = metadata.totalFiles;
                    totalBytesInBatch = metadata.totalBytes;
                    filesReceivedInBatch = 0;
                    bytesTransferredInBatch = 0;
                    document.getElementById('overall-status').style.display = 'block';
                    updateOverallSessionProgress();
                    console.log(`Receiving batch: ${totalFilesInBatch} files, ${formatBytes(totalBytesInBatch)}`);
                } else if (metadata.type === 'fileMetadata') {
                    const fileId = metadata.id;
                    receivedFileMetadata[fileId] = { ...metadata, receivedBytes: 0 };
                    receivedBuffers[fileId] = []; // Always buffer in memory first
                    currentReceivingFileId = fileId; // Set the current receiving file ID
                    disableFileSelection(); // Disable file selection during transfer
                    
                    // Add to transfer list as download
                    addTransferFile(metadata.name, metadata.size, 'download', 'receiving');
                    transferStartTime = Date.now();
                    
                    console.log('Receiving file:', metadata.name);

                } else if (metadata.type === 'fileEnd') {
                    const fileId = metadata.id;
                    const fileMeta = receivedFileMetadata[fileId];

                    if (fileMeta) {
                        console.log(`File ${fileMeta.name} received completely. Creating Blob...`);
                        const blob = new Blob(receivedBuffers[fileId], { type: fileMeta.fileType });
                        const url = URL.createObjectURL(blob);
                        
                        // Update transfer file status with download link
                        updateTransferFileStatus(fileMeta.name, 'download', 'received', url);

                        console.log(`File ${fileMeta.name} processed and added to list.`);
                        updateTransferProgress(0, 0); // Reset individual file progress

                        filesReceivedInBatch++;

                        if (filesReceivedInBatch === totalFilesInBatch) {
                            console.log('All files in batch received!');
                            currentBatchId = null;
                            totalFilesInBatch = 0;
                            filesReceivedInBatch = 0;
                            totalBytesInBatch = 0;
                            bytesTransferredInBatch = 0;
                            enableFileSelection(); // Re-enable file selection
                        }

                    } else {
                        console.warn(`Could not find metadata for fileId: ${fileId}.`);
                    }
                    currentReceivingFileId = null; // Clear the current receiving file ID
                    enableFileSelection(); // Re-enable file selection after receiving file
                }
            } catch (e) {
                console.error('Error parsing message as JSON:', e, message);
            }
        } else {
            // This is a file chunk (ArrayBuffer)
            if (currentReceivingFileId && receivedBuffers[currentReceivingFileId]) {
                receivedBuffers[currentReceivingFileId].push(message);
                const fileMeta = receivedFileMetadata[currentReceivingFileId];
                fileMeta.receivedBytes += message.byteLength;
                updateTransferProgress(fileMeta.receivedBytes, fileMeta.size, fileMeta.name);
                console.log(`Received chunk for ${fileMeta.name}. Current size: ${fileMeta.receivedBytes}/${fileMeta.size}`);

                bytesTransferredInBatch += message.byteLength;
            } else {
                console.warn('Received file chunk but no active file metadata or buffer found.');
            }
        }
    };

    channel.onclose = () => {
        console.log('DataChannel closed.');
    };

    channel.onerror = (error) => {
        console.error('DataChannel error:', error);
    };
}

async function handleFiles(files) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        alert('Data channel not open. Please wait for connection or ensure another user is in the room.');
        console.error('DataChannel not open. State:', dataChannel ? dataChannel.readyState : 'undefined');
        return;
    }

    if (files.length === 0) return; // No files selected
    
    // Only allow one file at a time
    if (files.length > 1) {
        alert('Please select only one file at a time.');
        return;
    }
    
    const file = files[0]; // Process only the first file
    disableFileSelection(); // Disable file selection during transfer
    currentSendingFileName = file.name;
    transferStartTime = Date.now();

    // Add to transfer list as upload
    addTransferFile(file.name, file.size, 'upload', 'sending');

    // Send single file metadata
    const fileId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const metadata = {
        type: 'fileMetadata',
        id: fileId,
        name: file.name,
        size: file.size,
        fileType: file.type
    };
    console.log('Sending file metadata:', metadata);
    dataChannel.send(JSON.stringify(metadata));

    const chunkSize = 16 * 1024; // 16KB chunks
    const bufferedAmountLowThreshold = 1 * 1024 * 1024; // 1MB
    let offset = 0;

    while (offset < file.size) {
        // Implement backpressure control
        if (dataChannel.bufferedAmount > bufferedAmountLowThreshold) {
            console.log(`Buffered amount high (${dataChannel.bufferedAmount} bytes). Pausing send.`);
            await new Promise(resolve => {
                dataChannel.onbufferedamountlow = () => {
                    console.log('Buffered amount low. Resuming send.');
                    dataChannel.onbufferedamountlow = null; // Remove listener
                    resolve();
                };
            });
        }

        const slice = file.slice(offset, offset + chunkSize);
        const buffer = await slice.arrayBuffer();
        dataChannel.send(buffer);
        offset += chunkSize;
        updateTransferProgress(offset, file.size, file.name); // Update progress with precise percentage
    }
    
    console.log(`Sending fileEnd for ${file.name} (ID: ${fileId})`);
    dataChannel.send(JSON.stringify({ type: 'fileEnd', id: fileId }));
    
    // Update transfer file status
    updateTransferFileStatus(file.name, 'upload', 'sent');
    
    // Re-enable file selection after transfer completes
    setTimeout(() => {
        enableFileSelection();
        updateTransferProgress(0, 0); // Reset progress bar
    }, 500);
}

// --- Utility Functions ---
function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString(); // Generates a 4-digit number
}

function displayRoomInfo(roomId) {
    roomSelectionDiv.classList.add('hidden');
    roomInfoDiv.classList.remove('hidden');
    displayRoomIdSpan.textContent = roomId;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Network status monitoring
function checkNetworkStatus() {
    if (!navigator.onLine) {
        connectionStatusP.textContent = 'No internet connection. Please check your network.';
        connectionStatusP.className = 'connection-failed';
        return false;
    }
    return true;
}

// Listen for online/offline events
window.addEventListener('online', () => {
    console.log('Network back online');
    if (currentRoomId) {
        socket.emit('reconnectToRoom', currentRoomId);
    }
});

window.addEventListener('offline', () => {
    console.log('Network went offline');
    connectionStatusP.textContent = 'Network connection lost. Waiting for reconnection...';
    connectionStatusP.className = 'connection-failed';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + O to open file picker
    if ((e.ctrlKey || e.metaKey) && e.key === 'o' && !isFileTransferInProgress) {
        e.preventDefault();
        if (!dropArea.classList.contains('disabled')) {
            fileInput.click();
        }
    }
    
    // ESC to cancel file transfer (if in progress)
    if (e.key === 'Escape' && isFileTransferInProgress) {
        if (confirm('Cancel file transfer?')) {
            enableFileSelection();
            hideTransferProgress();
        }
    }
    
    // Enter to join room
    if (e.key === 'Enter' && roomIdInput === document.activeElement) {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            socket.emit('joinRoom', roomId);
        }
    }
});
