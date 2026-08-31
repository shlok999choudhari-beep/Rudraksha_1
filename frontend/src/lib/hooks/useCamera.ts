'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Camera access for the live face capture step.
 *
 * Frames are handled entirely in the browser until the officer accepts a capture,
 * and the stream is released the moment the step is left — the console should not
 * hold an open camera while an officer works on other pages.
 */

export type CameraState =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'insecure'
  | 'error';

export interface CapturedFrame {
  blob: Blob;
  /** JPEG data URL, for immediate preview. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface UseCameraOptions {
  /** Requested capture size. The browser may return something close, not exact. */
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  /** Start the stream as soon as the hook mounts. */
  autoStart?: boolean;
}

export interface UseCameraResult {
  state: CameraState;
  /** Attach to a `<video muted playsInline />`. */
  videoRef: RefObject<HTMLVideoElement | null>;
  error: string | null;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  capture: (options?: { mirror?: boolean; quality?: number }) => Promise<CapturedFrame | null>;
  selectDevice: (deviceId: string) => Promise<void>;
}

const STATE_MESSAGES: Partial<Record<CameraState, string>> = {
  denied:
    'Camera access was blocked. Allow camera permission for this site, then start the capture again.',
  unavailable: 'No camera was found on this device. Connect one and retry.',
  insecure:
    'The browser only allows camera access over HTTPS or on localhost. Open the console on a secure origin.',
  error: 'The camera could not be started.',
};

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { width = 1280, height = 720, facingMode = 'user', autoStart = false } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState('idle');
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (typeof navigator === 'undefined') return;

      // `mediaDevices` is undefined on insecure origins, which is a different
      // problem from a denied permission and needs different advice.
      if (!navigator.mediaDevices?.getUserMedia) {
        const insecure =
          typeof window !== 'undefined' &&
          window.location.protocol !== 'https:' &&
          !['localhost', '127.0.0.1'].includes(window.location.hostname);
        const next: CameraState = insecure ? 'insecure' : 'unavailable';
        setState(next);
        setError(STATE_MESSAGES[next] ?? null);
        return;
      }

      setState('requesting');
      setError(null);

      // Release any existing stream first; two live tracks on one device fails
      // on several browsers.
      streamRef.current?.getTracks().forEach((track) => track.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
            : { facingMode, width: { ideal: width }, height: { ideal: height } },
          audio: false,
        });

        streamRef.current = stream;
        setActiveDeviceId(
          deviceId ?? stream.getVideoTracks()[0]?.getSettings().deviceId ?? null,
        );

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Autoplay can be refused even for a muted stream; the video element
            // still shows frames, so this is not worth failing the step over.
          }
        }

        setState('ready');

        // Labels are only populated after permission is granted, so enumerate now.
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          setDevices(list.filter((d) => d.kind === 'videoinput'));
        } catch {
          setDevices([]);
        }
      } catch (caught) {
        const name = caught instanceof Error ? caught.name : '';
        const next: CameraState =
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'denied'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'unavailable'
              : 'error';
        setState(next);
        setError(STATE_MESSAGES[next] ?? 'The camera could not be started.');
      }
    },
    [facingMode, height, width],
  );

  const selectDevice = useCallback(
    async (deviceId: string) => {
      await start(deviceId);
    },
    [start],
  );

  const capture = useCallback(
    async (captureOptions: { mirror?: boolean; quality?: number } = {}) => {
      const video = videoRef.current;
      if (!video || state !== 'ready') return null;

      const frameWidth = video.videoWidth;
      const frameHeight = video.videoHeight;
      if (!frameWidth || !frameHeight) return null;

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth;
      canvas.height = frameHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // The preview is mirrored so it reads like a mirror to the subject, but the
      // stored frame must not be, or the comparison crop would be flipped
      // relative to the document photograph.
      if (captureOptions.mirror) {
        ctx.translate(frameWidth, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, frameWidth, frameHeight);

      const quality = captureOptions.quality ?? 0.92;
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), 'image/jpeg', quality);
      });
      if (!blob) return null;

      return { blob, dataUrl, width: frameWidth, height: frameHeight };
    },
    [state],
  );

  useEffect(() => {
    if (autoStart) void start();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // Intentionally mount-only: re-running this would restart the camera on every
    // options change and interrupt a capture in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    videoRef,
    error,
    devices,
    activeDeviceId,
    start,
    stop,
    capture,
    selectDevice,
  };
}
