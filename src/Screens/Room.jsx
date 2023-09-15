import React, { useEffect, useCallback, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../Service/Peer";
import { useSocket } from "../Context/SocketProvider";
import { colors } from "@mui/material";
import style from './Room.module.css'

const RoomPage = () => {
  const socket = useSocket();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
  }, []);

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
  
      // Add the screen stream to your peer connection for sending
      for (const track of screenStream.getTracks()) {
        peer.peer.addTrack(track, screenStream);
      }
  
      setMyStream(screenStream);
      setIsScreenSharing(true);
  
      socket.emit("start:screenShare", remoteSocketId);
  
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };
  

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // If screen sharing is active, switch back to the camera stream
      setMyStream((prevStream) => {
        prevStream.getTracks().forEach((track) => {
          track.stop();
        });
  
        return new Promise(async (resolve) => {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
  
          // Add the camera stream to your peer connection
          for (const track of cameraStream.getTracks()) {
            peer.peer.addTrack(track, cameraStream);
          }
  
          resolve(cameraStream);
        });
      });
    } else {
      // If not screen sharing, start screen sharing
      startScreenShare();
    }
  
    setIsScreenSharing((prevIsScreenSharing) => !prevIsScreenSharing);
  };
  
  

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      setRemoteSocketId(from);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);



  useEffect(() => {
    peer.peer.addEventListener("track", async (ev) => {
      const remoteStream = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  return (
    <div >
      <h1>Meeting Room</h1>
      <h4>{remoteSocketId ? "Connected" : "Let some one to join the meeting"}</h4>
      {myStream && <button onClick={sendStreams}>Send Stream</button>}
      {remoteSocketId && <button onClick={handleCallUser}>CALL</button>}
      <div className={style.screen}>
        <div className={style.stream}>
      {myStream && (
        <>
          <h1>{isScreenSharing ? "Screen Share" : "My Stream"}</h1>
    <ReactPlayer
      playing
      muted={false}
      height="600px"
      width="600px"
      url={myStream}
    />
    <button onClick={toggleScreenShare}>
      {isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}
    </button>
  </>

      )}
        </div>
        <div className={style.stream}>
      {remoteStream && (
        <>
          <h1>Remote Stream</h1>
          <ReactPlayer
            playing
            muted={false}
            height="600px"
            width="600px"
            url={remoteStream}
          />
        </>
      )}
      </div>
      </div>
    </div>
  );
};

export default RoomPage;
