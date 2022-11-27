import { useEffect, useState } from "react";

import * as Tone from "tone";

import { InferenceResult } from "../types";

interface AudioPlayerProps {
  paused: boolean;
  inferenceResults: InferenceResult[];
}

/**
 * Audio player with Tone.js
 *
 * TODO(hayk): Look into https://github.com/E-Kuerschner/useAudioPlayer as an alternative.
 */
export default function AudioPlayer({
  paused,
  inferenceResults,
}: AudioPlayerProps) {
  // TODO(hayk): Rename
  const [tonePlayer, setTonePlayer] = useState<Tone.Player>(null);

  const [numClipsPlayed, setNumClipsPlayed] = useState(0);
  const [prevNumClipsPlayed, setPrevNumClipsPlayed] = useState(0);

  // TODO(hayk): What is this?
  const [resultCounter, setResultCounter] = useState(0);

  // On load, create a player synced to the tone transport
  useEffect(() => {
    if (tonePlayer) {
      return;
    }

    if (inferenceResults.length === 0) {
      return;
    }

    const audioUrl = inferenceResults[0].audio;

    const player = new Tone.Player(audioUrl, () => {
      player.loop = true;
      player.sync().start(0);

      // Set up a callback to increment numClipsPlayed at the edge of each clip
      const bufferLength = player.sampleTime * player.buffer.length;
      console.log(bufferLength, inferenceResults[0].duration_s);

      // TODO(hayk): Set this callback up to vary each time using duration_s
      Tone.Transport.scheduleRepeat((time) => {
        // TODO(hayk): Edge of clip callback
        console.log(
          "Edge of clip, t = ",
          Tone.Transport.getSecondsAtTime(time),
          ", bufferLength = ",
          bufferLength,
          ", tone transport seconds = ",
          Tone.Transport.seconds
        );

        setNumClipsPlayed((n) => n + 1);
      }, bufferLength);

      setTonePlayer(player);

      // Make further load callbacks do nothing.
      player.buffer.onload = () => {};
    }).toDestination();
  }, [tonePlayer, inferenceResults]);

  // On play/pause button, play/pause the audio with the tone transport
  useEffect(() => {
    if (!paused) {
      console.log("Play");

      if (Tone.context.state == "suspended") {
        Tone.context.resume();
      }

      if (tonePlayer) {
        Tone.Transport.start();
      }
    } else {
      console.log("Pause");

      if (tonePlayer) {
        Tone.Transport.pause();
      }
    }
  }, [paused, tonePlayer]);

  // If there is a new clip, switch to it
  useEffect(() => {
    if (numClipsPlayed == prevNumClipsPlayed) {
      return;
    }

    const maxResultCounter = Math.max(
      ...inferenceResults.map((r) => r.counter)
    );

    if (maxResultCounter < resultCounter) {
      console.info(
        "not picking a new result, none available",
        resultCounter,
        maxResultCounter
      );
      return;
    }

    const result = inferenceResults.find(
      (r: InferenceResult) => r.counter == resultCounter
    );

    setResultCounter((c) => c + 1);

    console.log("numClipsPlayed incremented ", Tone.Transport.seconds);

    tonePlayer.load(result.audio).then(() => {
      console.log(
        "Now playing result ",
        resultCounter,
        ", time is ",
        Tone.Transport.seconds
      );

      // Re-jigger the transport so it stops playing old buffers. It seems like this doesn't
      // introduce a gap, but watch out for that.
      Tone.Transport.pause();
      if (!paused) {
        Tone.Transport.start();
      }
    });

    setPrevNumClipsPlayed(numClipsPlayed);
  }, [
    numClipsPlayed,
    prevNumClipsPlayed,
    resultCounter,
    inferenceResults,
    paused,
    tonePlayer,
  ]);

  return null;
}