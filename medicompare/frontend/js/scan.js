/* =========================================================
   MediCompare — scan.js
   ========================================================= */

Auth.requireAuth();

const urlParams = new URLSearchParams(window.location.search);
let resolvedPatientId = urlParams.get('patient_id');
let selectedFile = null;
let cameraStream = null;

const tabs = document.querySelectorAll('.scan-tab');
const panels = document.querySelectorAll('.scan-panel');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    panels.forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    stopCamera();
  });
});

/* ---------- Resolve patient id up front ---------- */

async function resolvePatientId() {
  if (resolvedPatientId) return;
  try {
    const patients = await apiRequest('/api/patients');
    if (patients.length > 0) resolvedPatientId = patients[0].id;
  } catch (err) {
    showToast('Could not load your patient profile.', 'error');
  }
}
resolvePatientId();

/* ---------- File upload ---------- */

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewMount = document.getElementById('file-preview-mount');
const analyzeBtn = document.getElementById('analyze-btn');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFileSelected(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFileSelected(fileInput.files[0]);
});

function handleFileSelected(file) {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExtensions.includes(ext)) {
    showToast('Please choose a JPG, PNG, or PDF file.', 'error');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast('File is too large. Max size is 8 MB.', 'error');
    return;
  }
  selectedFile = file;
  renderFilePreview(file);
  analyzeBtn.disabled = false;
}

function renderFilePreview(file) {
  const isImage = file.type.startsWith('image/');
  const sizeKb = (file.size / 1024).toFixed(0);
  if (isImage) {
    const url = URL.createObjectURL(file);
    previewMount.innerHTML = `
      <div class="file-preview">
        <img src="${url}" alt="Selected prescription preview">
        <div class="file-preview-info"><strong>${file.name}</strong><span>${sizeKb} KB</span></div>
        <button class="btn btn-ghost btn-sm" id="clear-file-btn">Remove</button>
      </div>`;
  } else {
    previewMount.innerHTML = `
      <div class="file-preview">
        <div class="file-preview-icon">📄</div>
        <div class="file-preview-info"><strong>${file.name}</strong><span>${sizeKb} KB · PDF</span></div>
        <button class="btn btn-ghost btn-sm" id="clear-file-btn">Remove</button>
      </div>`;
  }
  document.getElementById('clear-file-btn').addEventListener('click', () => {
    selectedFile = null;
    previewMount.innerHTML = '';
    fileInput.value = '';
    analyzeBtn.disabled = true;
  });
}

/* ---------- Camera ---------- */

const video = document.getElementById('camera-video');
const canvas = document.getElementById('camera-canvas');
const startBtn = document.getElementById('camera-start-btn');
const captureBtn = document.getElementById('camera-capture-btn');
const retakeBtn = document.getElementById('camera-retake-btn');

startBtn.addEventListener('click', async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = cameraStream;
    video.style.display = 'block';
    canvas.style.display = 'none';
    startBtn.style.display = 'none';
    captureBtn.style.display = 'inline-flex';
  } catch (err) {
    showToast('Could not access the camera. Check permissions or use file upload instead.', 'error');
  }
});

captureBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  video.style.display = 'none';
  canvas.style.display = 'block';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'inline-flex';

  canvas.toBlob((blob) => {
    selectedFile = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
    analyzeBtn.disabled = false;
  }, 'image/jpeg', 0.9);
});

retakeBtn.addEventListener('click', () => {
  video.style.display = 'block';
  canvas.style.display = 'none';
  captureBtn.style.display = 'inline-flex';
  retakeBtn.style.display = 'none';
  selectedFile = null;
  analyzeBtn.disabled = true;
});

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  startBtn.style.display = 'inline-flex';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'none';
}

/* ---------- Submit (upload or camera capture) ---------- */

analyzeBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  submitPrescription({ file: selectedFile, useDemo: false });
});

document.getElementById('demo-btn').addEventListener('click', () => {
  submitPrescription({ file: null, useDemo: true });
});

async function submitPrescription({ file, useDemo }) {
  await resolvePatientId();
  if (!resolvedPatientId) {
    showToast('No patient profile available yet. Please try again.', 'error');
    return;
  }

  stopCamera();
  showStage('processing');
  animateProcessingSteps();

  const formData = new FormData();
  formData.append('patient_id', resolvedPatientId);
  formData.append('use_demo', useDemo ? 'true' : 'false');
  if (file) formData.append('file', file);

  try {
    const prescription = await apiRequest('/api/prescriptions/upload', {
      method: 'POST',
      body: formData,
      isForm: true,
    });
    window.location.href = `analysis.html?id=${prescription.id}`;
  } catch (err) {
    showStage('error');
    document.getElementById('error-message').textContent = err.message;
  }
}

function showStage(stage) {
  document.getElementById('upload-stage').style.display = stage === 'upload' ? 'block' : 'none';
  document.getElementById('processing-stage').style.display = stage === 'processing' ? 'block' : 'none';
  document.getElementById('error-stage').style.display = stage === 'error' ? 'block' : 'none';
}

function animateProcessingSteps() {
  const steps = ['step-1', 'step-2', 'step-3', 'step-4'];
  steps.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('done');
    }, (i + 1) * 500);
  });
}

document.getElementById('retry-btn').addEventListener('click', () => {
  showStage('upload');
});
