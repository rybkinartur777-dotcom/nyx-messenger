import { socketService } from './socketService';
import { useStore } from '../store/useStore';
import { CallSession } from '../types';

class CallService {
    private peerConnection: RTCPeerConnection | null = null;
    private iceCandidatesQueue: RTCIceCandidateInit[] = [];
    private localStream: MediaStream | null = null;

    private rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };

    // 1. Caller starts the call
    async startCall(chatId: string, peerId: string, peerName: string, peerAvatar?: string, type: 'audio' | 'video' = 'audio') {
        const socket = socketService.getSocket();
        const user = useStore.getState().user;
        if (!socket || !user) {
            console.error('Socket or user not initialized');
            return;
        }

        console.log(`📞 Starting ${type} call to user ${peerName} (${peerId})`);

        // Set call state in Zustand
        const session: CallSession = {
            chatId,
            peerId,
            peerName,
            peerAvatar,
            direction: 'outgoing',
            status: 'ringing',
            type
        };
        useStore.getState().setActiveCall(session);

        // Emit call initiation to server
        socket.emit('call:initiate', {
            chatId,
            callerId: user.id,
            callerName: user.nickname,
            callerAvatar: user.avatar,
            calleeId: peerId,
            type
        });
    }

    // 2. Callee receives the incoming call event
    handleIncomingCall(data: { chatId: string; callerId: string; callerName: string; callerAvatar?: string; type: 'audio' | 'video' }) {
        console.log('📞 Incoming call data received:', data);
        const { activeCall } = useStore.getState();

        // If callee is already in a call, reject automatically
        if (activeCall) {
            console.log('Busy, rejecting incoming call');
            const socket = socketService.getSocket();
            if (socket) {
                socket.emit('call:reject', {
                    chatId: data.chatId,
                    callerId: data.callerId,
                    calleeId: useStore.getState().user?.id
                });
            }
            return;
        }

        const session: CallSession = {
            chatId: data.chatId,
            peerId: data.callerId,
            peerName: data.callerName,
            peerAvatar: data.callerAvatar,
            direction: 'incoming',
            status: 'ringing',
            type: data.type
        };
        useStore.getState().setActiveCall(session);
    }

    // 3. Callee accepts the call
    async acceptCall() {
        const { activeCall, user } = useStore.getState();
        const socket = socketService.getSocket();
        if (!activeCall || !user || !socket) return;

        console.log('👍 Accepting incoming call...');
        
        // Update status to connected
        useStore.getState().setActiveCall({
            ...activeCall,
            status: 'connected'
        });

        // Notify caller
        socket.emit('call:accept', {
            chatId: activeCall.chatId,
            callerId: activeCall.peerId,
            calleeId: user.id
        });

        // Initialize PeerConnection and local stream, but wait for Caller's SDP offer
        await this.setupMediaAndPeer(activeCall.type);
    }

    // 4. Callee rejects the call
    rejectCall() {
        const { activeCall, user } = useStore.getState();
        const socket = socketService.getSocket();
        if (!activeCall || !user || !socket) return;

        console.log('👎 Rejecting incoming call');
        socket.emit('call:reject', {
            chatId: activeCall.chatId,
            callerId: activeCall.peerId,
            calleeId: user.id
        });

        this.endCall();
    }

    // 5. Caller receives call:accepted, initiates WebRTC PeerConnection & sends SDP Offer
    async handleAcceptedCall() {
        const { activeCall } = useStore.getState();
        if (!activeCall) return;

        console.log('✅ Call accepted by peer. Setting up WebRTC offer...');

        // Update status to connected
        useStore.getState().setActiveCall({
            ...activeCall,
            status: 'connected'
        });

        // Setup Media & PeerConnection
        const pc = await this.setupMediaAndPeer(activeCall.type);
        if (!pc) return;

        // Create SDP Offer
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const socket = socketService.getSocket();
            const user = useStore.getState().user;
            if (socket && user) {
                socket.emit('call:signal', {
                    chatId: activeCall.chatId,
                    senderId: user.id,
                    receiverId: activeCall.peerId,
                    signalData: { sdp: pc.localDescription }
                });
            }
        } catch (error) {
            console.error('Error creating SDP offer:', error);
            this.endCall();
        }
    }

    // 6. Setup Media Stream and RTCPeerConnection
    private async setupMediaAndPeer(type: 'audio' | 'video'): Promise<RTCPeerConnection | null> {
        // Stop any existing streams first
        this.stopLocalStream();

        try {
            // Get local stream
            const constraints = {
                audio: true,
                video: type === 'video' ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                } : false
            };

            console.log('Requesting user media constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localStream = stream;
            useStore.getState().setLocalStream(stream);

            // Create PeerConnection
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);

            // Add local tracks to peer connection
            stream.getTracks().forEach(track => {
                if (this.peerConnection && this.localStream) {
                    this.peerConnection.addTrack(track, this.localStream);
                }
            });

            // Handle remote track arrival
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote track event:', event);
                const remoteStream = event.streams[0] || new MediaStream([event.track]);
                useStore.getState().setRemoteStream(remoteStream);
            };

            // Handle ICE candidates generated locally
            this.peerConnection.onicecandidate = (event) => {
                const { activeCall, user } = useStore.getState();
                const socket = socketService.getSocket();
                if (event.candidate && activeCall && user && socket) {
                    socket.emit('call:signal', {
                        chatId: activeCall.chatId,
                        senderId: user.id,
                        receiverId: activeCall.peerId,
                        signalData: { candidate: event.candidate }
                    });
                }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE Connection State:', this.peerConnection?.iceConnectionState);
                if (this.peerConnection?.iceConnectionState === 'disconnected' ||
                    this.peerConnection?.iceConnectionState === 'failed' ||
                    this.peerConnection?.iceConnectionState === 'closed') {
                    // Let the end call signal trigger disconnect or clean up
                }
            };

            return this.peerConnection;
        } catch (error) {
            console.error('Failed to get media devices or build PeerConnection:', error);
            useStore.getState().addToast({
                title: 'Ошибка звонка',
                body: 'Не удалось получить доступ к камере или микрофону'
            });
            this.endCall();
            return null;
        }
    }

    // 7. Handle incoming signaling messages (SDP offer/answer and ICE candidates)
    async handleSignal(data: { senderId: string; signalData: any }) {
        const { activeCall } = useStore.getState();
        if (!activeCall) return;

        const { sdp, candidate } = data.signalData;

        if (sdp) {
            console.log(`Received SDP signal (${sdp.type}) from ${data.senderId}`);
            
            // If PeerConnection is not setup, build it (Callee side receiving Offer)
            if (!this.peerConnection) {
                await this.setupMediaAndPeer(activeCall.type);
            }

            if (!this.peerConnection) return;

            try {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

                // Process any queued ICE candidates
                while (this.iceCandidatesQueue.length > 0) {
                    const cand = this.iceCandidatesQueue.shift();
                    if (cand) {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                    }
                }

                // If it was an offer, we must create an answer
                if (sdp.type === 'offer') {
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);

                    const socket = socketService.getSocket();
                    const user = useStore.getState().user;
                    if (socket && user) {
                        socket.emit('call:signal', {
                            chatId: activeCall.chatId,
                            senderId: user.id,
                            receiverId: activeCall.peerId,
                            signalData: { sdp: this.peerConnection.localDescription }
                        });
                    }
                }
            } catch (error) {
                console.error('Error handling SDP signal:', error);
                this.endCall();
            }
        } else if (candidate) {
            console.log('Received ICE Candidate from peer');
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            } else {
                // Queue candidate if remote description is not set yet
                this.iceCandidatesQueue.push(candidate);
            }
        }
    }

    // 8. Stop media streams
    private stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped track: ${track.kind}`);
            });
            this.localStream = null;
        }
        useStore.getState().setLocalStream(null);
        useStore.getState().setRemoteStream(null);
    }

    // 9. Hangup call locally & emit end call to socket
    hangupCall() {
        const { activeCall, user } = useStore.getState();
        const socket = socketService.getSocket();
        if (activeCall && user && socket) {
            console.log('Emitting call:end to peer');
            socket.emit('call:end', {
                chatId: activeCall.chatId,
                callerId: activeCall.direction === 'outgoing' ? user.id : activeCall.peerId,
                calleeId: activeCall.direction === 'incoming' ? user.id : activeCall.peerId
            });
        }
        this.endCall();
    }

    // 10. Clean up call connection & reset state
    endCall() {
        console.log('🧹 Cleaning up and ending WebRTC call...');
        
        this.stopLocalStream();

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.iceCandidatesQueue = [];
        useStore.getState().resetCallState();
    }
}

export const callService = new CallService();
