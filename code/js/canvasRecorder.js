// Note: this is a canvas recorder, but ensure you let the users know that their still is licensing/terms linked to the map.
// Attribution to Esri is required as well as the data when sharing.

define([], function () {
  let recording = false;
  let mediaRecorder;
  let recordedChunks = [];

  function updateUI(startDisabled, stopDisabled, showDownload = false) {
    document.getElementById("start-record").disabled = startDisabled;
    document.getElementById("stop-record").disabled = stopDisabled;

    if (showDownload) {
      document.getElementById("copy-card").style.display = "block";
      document.getElementById("download-btn").style.display = "block";
    }
  }

  function handleRecordingStop() {
    const attributionSource = document.querySelector(".esri-attribution__sources");
    const blob = new Blob(recordedChunks, { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    const downloadButton = document.getElementById("download-btn");
    downloadButton.href = url;
    downloadButton.download = "pulse-recording.mp4";

    const quoteText = document.getElementById("quote-text");
    if (attributionSource) {
      quoteText.innerHTML += attributionSource.innerText;
    }
    quoteText.innerHTML += " Powered by Esri, Made with Pulse seanst.one/demos/pulse";

    updateUI(false, true, true);
  }

  return {
    startRecording: function (canvas) {
      if (recording) return;
      recording = true;
      recordedChunks = [];

      updateUI(true, false);

      // Capture canvas stream at 30 FPS
      const stream = canvas.captureStream(30);
      const options = {
        mimeType: 'video/mp4; codecs="avc1.424028, mp4a.40.2"',
        videoBitsPerSecond: 10000000,
      };

      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecordingStop;

      mediaRecorder.start();
    },

    stopRecording: function () {
      if (!recording) return;
      recording = false;

      updateUI(false, true);

      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    },
  };
});
