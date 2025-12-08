import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, Users, Hand, Video, Mic, Phone, Send, Settings } from 'lucide-react';

export const LiveClassRoom: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liveClass, setLiveClass] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  useEffect(() => {
    const load = async () => {
      if (!classId) return;
      try {
        const classesRes = await api.getLiveClasses();
        if (classesRes.ok) {
          const cls = classesRes.data.find((c: any) => c.id === classId);
          if (cls) {
            setLiveClass(cls);
            if (user?.id) {
              await api.joinLiveClass(classId, user.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load live class:', error);
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => {
      if (user?.id && classId) {
        api.leaveLiveClass(classId, user.id);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [classId, user?.id]);

  useEffect(() => {
    if (!classId) return;

    const pollData = async () => {
      const [participantsRes, messagesRes] = await Promise.all([
        api.getLiveClassParticipants(classId),
        api.getLiveClassMessages(classId),
      ]);
      if (participantsRes.ok) setParticipants(participantsRes.data);
      if (messagesRes.ok) setMessages(messagesRes.data);
    };

    pollData();
    pollIntervalRef.current = setInterval(pollData, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [classId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !classId || !user?.id) return;

    try {
      const res = await api.sendLiveClassMessage(classId, user.id, messageInput);
      if (res.ok) {
        setMessageInput('');
        const messagesRes = await api.getLiveClassMessages(classId);
        if (messagesRes.ok) setMessages(messagesRes.data);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleCameraToggle = async () => {
    if (!classId || !user?.id) return;
    const newState = !cameraOn;
    setCameraOn(newState);
    await api.updateParticipantStatus(classId, user.id, newState, microphoneOn);
  };

  const handleMicToggle = async () => {
    if (!classId || !user?.id) return;
    const newState = !microphoneOn;
    setMicrophoneOn(newState);
    await api.updateParticipantStatus(classId, user.id, cameraOn, newState);
  };

  const handleRaiseHand = async () => {
    if (!classId || !user?.id) return;
    const newState = !handRaised;
    setHandRaised(newState);
    await api.raiseHand(classId, user.id, newState);
  };

  const handleStartRecording = async () => {
    if (!classId) return;
    try {
      const recordingUrl = `${classId}-recording-${Date.now()}`;
      const res = await api.startLiveClassRecording(classId, recordingUrl);
      if (res.ok) {
        setRecording(true);
        setRecordingStartTime(new Date());
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    if (!classId || !recordingStartTime) return;
    try {
      const duration = Math.floor((Date.now() - recordingStartTime.getTime()) / 1000);
      const res = await api.stopLiveClassRecording(classId, duration);
      if (res.ok) {
        setRecording(false);
        setRecordingStartTime(null);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleLeave = async () => {
    if (recording) {
      await handleStopRecording();
    }
    if (classId && user?.id) {
      await api.leaveLiveClass(classId, user.id);
    }
    navigate('/live-classes');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading live class...</div>
      </div>
    );
  }

  if (!liveClass) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Live class not found</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col gap-4">
          <iframe
            ref={iframeRef}
            allow="camera; microphone; display-capture"
            src={`${liveClass.meetingLink}?name=${user?.name || 'User'}`}
            className="flex-1 rounded-lg border border-gray-700"
            title="Jitsi Meet"
          />

          <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="text-white text-sm">
              {liveClass.subjectId ? `${liveClass.subjectId}` : 'Live Class'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCameraToggle}
                className={`p-2 rounded-full transition-colors ${
                  cameraOn
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Toggle Camera"
              >
                <Video size={20} />
              </button>
              <button
                onClick={handleMicToggle}
                className={`p-2 rounded-full transition-colors ${
                  microphoneOn
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Toggle Microphone"
              >
                <Mic size={20} />
              </button>
              <button
                onClick={handleRaiseHand}
                className={`p-2 rounded-full transition-colors ${
                  handRaised
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Raise Hand"
              >
                <Hand size={20} />
              </button>
              {isTeacher && (
                <button
                  onClick={recording ? handleStopRecording : handleStartRecording}
                  className={`p-2 rounded-full transition-colors ${
                    recording
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={recording ? 'Stop Recording' : 'Start Recording'}
                >
                  <Settings size={20} />
                </button>
              )}
              <button
                onClick={() => setShowChat(!showChat)}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300"
                title="Toggle Chat"
              >
                <MessageCircle size={20} />
              </button>
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300"
                title="Show Participants"
              >
                <Users size={20} />
              </button>
              <button
                onClick={handleLeave}
                className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
                title="Leave Class"
              >
                <Phone size={20} />
              </button>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="w-80 bg-gray-800 rounded-lg flex flex-col gap-4 p-4">
            <h3 className="text-white font-semibold">Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-gray-700 rounded p-2 text-sm text-gray-100">
                  <div className="font-semibold text-blue-400">{msg.userId}</div>
                  <div>{msg.message}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type message..."
                className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {showParticipants && (
          <div className="w-64 bg-gray-800 rounded-lg flex flex-col gap-4 p-4">
            <h3 className="text-white font-semibold">Participants ({participants.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {participants.map((participant) => (
                <div key={participant.id} className="bg-gray-700 rounded p-3 text-sm text-gray-100">
                  <div className="font-semibold text-blue-400">{participant.userId}</div>
                  <div className="flex gap-2 mt-1 text-xs">
                    {participant.cameraOn && (
                      <span className="bg-blue-600 rounded px-2 py-1">Camera On</span>
                    )}
                    {participant.microphoneOn && (
                      <span className="bg-green-600 rounded px-2 py-1">Mic On</span>
                    )}
                    {participant.handRaised && (
                      <span className="bg-yellow-600 rounded px-2 py-1">Hand Raised</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
