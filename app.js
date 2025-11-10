
const form = document.getElementById('pressKitForm');
const previewContainer = document.getElementById('previewPages');
const toastContainer = document.querySelector('.toast-container');
const loadingOverlay = document.getElementById('loadingOverlay');
const emailModal = document.getElementById('emailModal');
const emailForm = document.getElementById('emailForm');
const closeEmailModalButton = document.getElementById('closeEmailModal');
const emailCancelButton = document.getElementById('emailCancelButton');
const downloadPdfButton = document.getElementById('downloadPdfButton');
const sendEmailButton = document.getElementById('sendEmailButton');
const copyShareButton = document.getElementById('copyShareButton');
const previewButton = document.getElementById('previewButton');
const resetButton = document.getElementById('resetButton');
let lastActiveElement = null;

const PAGE_SIZES = {
  letter: { label: 'US Letter', widthPt: 612, heightPt: 792 },
  a4: { label: 'A4', widthPt: 595.28, heightPt: 841.89 },
};

const REQUIRED_FIELDS = [
  'artistName',
  'tagline',
  'bio',
  'genre',
  'location',
  'streamingUrl',
  'website',
  'contactName',
  'contactEmail',
];

const state = {
  artistName: '',
  tagline: '',
  bio: '',
  genre: '',
  location: '',
  forFansOf: '',
  streamingUrl: '',
  website: '',
  socialLinks: [],
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  epkNotes: '',
  pageSize: 'letter',
  pressPhoto: {
    dataUrl: '',
    source: '',
    status: 'idle',
    error: '',
  },
  secondaryImage: {
    dataUrl: '',
    source: '',
    status: 'idle',
    error: '',
  },
  logoOverride: {
    dataUrl: '',
    source: '',
    status: 'idle',
    error: '',
  },
  pendingImagePromises: new Set(),
};

const DEFAULT_LOGO_PATH = 'assets/logo.svg';
let defaultLogoDataUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  preloadDefaultLogo();
  wireForm();
  parseDeepLink();
  renderPreview();
});

function preloadDefaultLogo() {
  fetch(DEFAULT_LOGO_PATH)
    .then((res) => res.blob())
    .then((blob) => blobToDataUrl(blob))
    .then((dataUrl) => {
      defaultLogoDataUrl = dataUrl;
      renderPreview();
    })
    .catch(() => {
      defaultLogoDataUrl = '';
    });
}

function wireForm() {
  form.addEventListener('input', handleFormChange);
  form.addEventListener('change', handleFormChange);
  form.addEventListener('reset', () => {
    setTimeout(() => {
      clearState();
      renderPreview();
      showToast('Form cleared', 'info');
    }, 0);
  });

  downloadPdfButton.addEventListener('click', async () => {
    if (!validateForm()) return;
    await triggerPdfDownload();
  });

  sendEmailButton.addEventListener('click', () => {
    if (!validateForm()) return;
    openEmailModal();
  });

  previewButton.addEventListener('click', () => {
    previewContainer.scrollIntoView({ behavior: 'smooth' });
  });

  copyShareButton.addEventListener('click', handleCopyShareBlurb);

  emailForm.addEventListener('submit', handleEmailSubmit);
  closeEmailModalButton.addEventListener('click', closeEmailModal);
  emailCancelButton.addEventListener('click', closeEmailModal);

  emailModal.addEventListener('click', (event) => {
    if (event.target === emailModal) {
      closeEmailModal();
    }
  });

  document.addEventListener('keydown', handleGlobalKeyDown);
}

function handleFormChange(event) {
  const formData = new FormData(form);

  state.artistName = (formData.get('artistName') || '').trim();
  state.tagline = (formData.get('tagline') || '').trim();
  state.bio = (formData.get('bio') || '').trim();
  state.genre = (formData.get('genre') || '').trim();
  state.location = (formData.get('location') || '').trim();
  state.forFansOf = (formData.get('forFansOf') || '').trim();
  state.streamingUrl = (formData.get('streamingUrl') || '').trim();
  state.website = (formData.get('website') || '').trim();
  const socials = (formData.get('socialLinks') || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  state.socialLinks = socials;
  state.contactName = (formData.get('contactName') || '').trim();
  state.contactEmail = (formData.get('contactEmail') || '').trim();
  state.contactPhone = (formData.get('contactPhone') || '').trim();
  state.epkNotes = (formData.get('epkNotes') || '').trim();
  state.pageSize = formData.get('pageSize') || 'letter';

  const logoUrl = (formData.get('logoUrl') || '').trim();
  if (event?.target?.name === 'logoUrl') {
    loadRemoteImage(logoUrl, state.logoOverride, true);
  }

  if (event?.target?.name === 'pressPhotoUrl') {
    const url = (formData.get('pressPhotoUrl') || '').trim();
    loadRemoteImage(url, state.pressPhoto, true);
  }

  if (event?.target?.name === 'secondaryImageUrl') {
    const url = (formData.get('secondaryImageUrl') || '').trim();
    loadRemoteImage(url, state.secondaryImage, true);
  }

  if (event?.target?.name === 'pressPhotoFile') {
    const file = event.target.files?.[0];
    loadLocalImage(file, state.pressPhoto);
  }

  if (event?.target?.name === 'secondaryImageFile') {
    const file = event.target.files?.[0];
    loadLocalImage(file, state.secondaryImage);
  }

  if (event?.target?.name === 'pressPhotoUrl' && !state.pressPhoto.dataUrl) {
    state.pressPhoto.error = '';
  }

  if (event?.target?.name === 'secondaryImageUrl' && !state.secondaryImage.dataUrl) {
    state.secondaryImage.error = '';
  }

  renderPreview();
  validateField(event?.target?.name);
}

function clearState() {
  Object.assign(state, {
    artistName: '',
    tagline: '',
    bio: '',
    genre: '',
    location: '',
    forFansOf: '',
    streamingUrl: '',
    website: '',
    socialLinks: [],
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    epkNotes: '',
    pageSize: 'letter',
  });
  state.pressPhoto = { dataUrl: '', source: '', status: 'idle', error: '' };
  state.secondaryImage = { dataUrl: '', source: '', status: 'idle', error: '' };
  state.logoOverride = { dataUrl: '', source: '', status: 'idle', error: '' };
  state.pendingImagePromises.clear();
  clearAllErrors();
}

function validateForm() {
  let valid = true;
  REQUIRED_FIELDS.forEach((field) => {
    if (!validateField(field)) {
      valid = false;
    }
  });
  if (!state.pressPhoto.dataUrl) {
    setError('pressPhoto', 'Add a press photo via URL or upload.');
    valid = false;
  }
  if (state.streamingUrl && !isValidHttpUrl(state.streamingUrl)) {
    setError('streamingUrl', 'Enter a valid URL starting with http or https.');
    valid = false;
  }
  if (state.website && !isValidHttpUrl(state.website)) {
    setError('website', 'Enter a valid URL starting with http or https.');
    valid = false;
  }
  state.socialLinks.forEach((link) => {
    if (!isValidHttpUrl(link)) {
      setError('socialLinks', 'All social links must be valid URLs.');
      valid = false;
    }
  });
  if (state.contactEmail && !isValidEmail(state.contactEmail)) {
    setError('contactEmail', 'Enter a valid email address.');
    valid = false;
  }
  return valid;
}

function validateField(fieldName) {
  if (!fieldName) return true;
  if (REQUIRED_FIELDS.includes(fieldName)) {
    const value = state[fieldName];
    if (!value) {
      setError(fieldName, 'This field is required.');
      return false;
    }
  }
  if (fieldName === 'contactEmail' && state.contactEmail && !isValidEmail(state.contactEmail)) {
    setError('contactEmail', 'Enter a valid email address.');
    return false;
  }
  if ((fieldName === 'streamingUrl' || fieldName === 'website') && state[fieldName] && !isValidHttpUrl(state[fieldName])) {
    setError(fieldName, 'Enter a valid URL starting with http or https.');
    return false;
  }
  clearError(fieldName);
  return true;
}

function setError(fieldName, message) {
  const errorElement = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearError(fieldName) {
  const errorElement = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorElement) {
    errorElement.textContent = '';
  }
}

function clearAllErrors() {
  document.querySelectorAll('.error').forEach((el) => {
    el.textContent = '';
  });
}

function isValidEmail(email) {
  return /.+@.+\..+/.test(email);
}

function isValidHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function loadLocalImage(file, target) {
  if (!file) {
    if (target.source === 'upload') {
      target.dataUrl = '';
      target.source = '';
    }
    target.error = '';
    renderPreview();
    return;
  }
  target.status = 'loading';
  const promise = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      target.dataUrl = reader.result;
      target.source = 'upload';
      target.status = 'ready';
      target.error = '';
      renderPreview();
      resolve();
    };
    reader.onerror = () => {
      target.error = 'Unable to read file. Try another image.';
      target.status = 'error';
      renderPreview();
      reject(new Error('File read error'));
    };
    reader.readAsDataURL(file);
  });
  trackPendingImagePromise(promise);
}

function loadRemoteImage(url, target, rerender) {
  if (!url) {
    if (target.source === 'url') {
      target.dataUrl = '';
      target.source = '';
    }
    target.error = '';
    if (rerender) renderPreview();
    return;
  }

  target.status = 'loading';
  const controller = new AbortController();
  const promise = fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Image request failed (${response.status})`);
      }
      return response.blob();
    })
    .then((blob) => blobToDataUrl(blob))
    .then((dataUrl) => {
      target.dataUrl = dataUrl;
      target.source = 'url';
      target.status = 'ready';
      target.error = '';
      renderPreview();
    })
    .catch((error) => {
      if (error.name === 'AbortError') return;
      target.error = 'Image unavailable. Try uploading a local file instead.';
      target.status = 'error';
      renderPreview();
    });

  trackPendingImagePromise(promise);
  return () => controller.abort();
}

function trackPendingImagePromise(promise) {
  state.pendingImagePromises.add(promise);
  promise.finally(() => state.pendingImagePromises.delete(promise));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function renderPreview() {
  previewContainer.innerHTML = '';
  const pageSize = PAGE_SIZES[state.pageSize] || PAGE_SIZES.letter;
  const previewWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-width'));
  const pageHeightPx = Math.round(previewWidth * (pageSize.heightPt / pageSize.widthPt));

  const sections = buildSections();
  const pages = paginateSections(sections, pageHeightPx);

  pages.forEach((page) => {
    const pageElement = document.createElement('article');
    pageElement.className = 'press-page';
    pageElement.style.setProperty('--page-height', `${pageHeightPx}px`);
    pageElement.style.height = `${pageHeightPx}px`;
    const content = document.createElement('div');
    content.className = 'press-page-content';
    page.forEach((section) => content.appendChild(section));
    pageElement.appendChild(content);
    previewContainer.appendChild(pageElement);
  });
}

function buildSections() {
  const sections = [];
  sections.push(buildHeaderSection());
  sections.push(buildHeroSection());
  sections.push(buildTaglineSection());
  sections.push(buildBioSection());
  sections.push(buildFactsSection());
  sections.push(buildLinksSection());
  sections.push(buildContactSection());
  if (state.epkNotes) {
    sections.push(buildNotesSection());
  }
  if (state.secondaryImage.dataUrl || state.secondaryImage.error) {
    sections.push(buildSecondaryImageSection());
  }
  return sections.filter(Boolean);
}

function buildHeaderSection() {
  const section = document.createElement('section');
  section.className = 'page-header';

  const logoWrapper = document.createElement('div');
  const logoImg = document.createElement('img');
  if (state.logoOverride.dataUrl) {
    logoImg.src = state.logoOverride.dataUrl;
  } else if (defaultLogoDataUrl) {
    logoImg.src = defaultLogoDataUrl;
  }
  logoImg.alt = 'Guttersville Records logo';
  logoWrapper.appendChild(logoImg);

  const title = document.createElement('div');
  title.innerHTML = `
    <div class="brandline">${state.artistName || 'Artist Name'}</div>
    <div class="subtitle">${state.genre || 'Genre'} · ${state.location || 'Location'}</div>
  `;
  section.appendChild(logoWrapper);
  section.appendChild(title);
  return section;
}

function buildHeroSection() {
  const section = document.createElement('section');
  section.className = 'hero-image';
  if (state.pressPhoto.status === 'loading') {
    section.textContent = 'Loading image…';
  } else if (state.pressPhoto.dataUrl) {
    const img = document.createElement('img');
    img.src = state.pressPhoto.dataUrl;
    img.alt = `${state.artistName || 'Artist'} press photo`;
    section.appendChild(img);
  } else {
    const message = state.pressPhoto.error || 'Add a press photo to complete your kit.';
    section.textContent = message;
  }
  return section;
}

function buildTaglineSection() {
  const section = document.createElement('section');
  section.className = 'tagline';
  section.textContent = state.tagline || 'Punchy artist tagline goes here.';
  return section;
}

function buildBioSection() {
  const section = document.createElement('section');
  section.className = 'bio';
  section.textContent = state.bio || 'Share the story, accolades, and highlights that make this artist unmissable.';
  return section;
}

function buildFactsSection() {
  const section = document.createElement('section');
  section.className = 'key-facts';

  const facts = [
    { label: 'Genre', value: state.genre },
    { label: 'Location', value: state.location },
  ];
  if (state.forFansOf) {
    facts.push({ label: 'For fans of', value: state.forFansOf });
  }

  facts.forEach(({ label, value }) => {
    const factEl = document.createElement('div');
    factEl.className = 'fact';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = value || '—';
    factEl.appendChild(labelEl);
    factEl.appendChild(valueEl);
    section.appendChild(factEl);
  });

  return section;
}

function buildLinksSection() {
  const section = document.createElement('section');
  section.className = 'link-buttons';

  if (state.streamingUrl) {
    const streamingLink = document.createElement('a');
    streamingLink.href = state.streamingUrl;
    streamingLink.textContent = 'Streaming';
    streamingLink.target = '_blank';
    streamingLink.rel = 'noopener';
    streamingLink.dataset.linkType = 'streaming';
    section.appendChild(streamingLink);
  }

  if (state.website) {
    const websiteLink = document.createElement('a');
    websiteLink.href = state.website;
    websiteLink.textContent = 'Website';
    websiteLink.target = '_blank';
    websiteLink.rel = 'noopener';
    websiteLink.dataset.linkType = 'website';
    section.appendChild(websiteLink);
  }

  state.socialLinks.forEach((link, index) => {
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.textContent = formatSocialLabel(link, index);
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.dataset.linkType = 'social';
    section.appendChild(anchor);
  });

  if (!section.children.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'fact';
    const label = document.createElement('span');
    label.textContent = 'Links';
    const value = document.createElement('span');
    value.textContent = 'Add streaming, website, or social links to showcase the artist.';
    placeholder.appendChild(label);
    placeholder.appendChild(value);
    return placeholder;
  }

  return section;
}

function formatSocialLabel(url, index) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('instagram')) return 'Instagram';
    if (parsed.hostname.includes('facebook')) return 'Facebook';
    if (parsed.hostname.includes('tiktok')) return 'TikTok';
    if (parsed.hostname.includes('youtube')) return 'YouTube';
    if (parsed.hostname.includes('twitter') || parsed.hostname.includes('x.com')) return 'Twitter';
    if (parsed.hostname.includes('bandcamp')) return 'Bandcamp';
    return parsed.hostname.replace('www.', '');
  } catch (error) {
    return `Social ${index + 1}`;
  }
}

function buildContactSection() {
  const section = document.createElement('section');
  section.className = 'contact-block';

  const heading = document.createElement('h3');
  heading.textContent = 'Contact';
  section.appendChild(heading);

  const contactLine = document.createElement('span');
  const emailPart = state.contactEmail ? state.contactEmail : 'email@example.com';
  contactLine.textContent = `${state.contactName || 'Name'} · ${emailPart}`;
  section.appendChild(contactLine);

  if (state.contactPhone) {
    const phoneLine = document.createElement('span');
    phoneLine.textContent = state.contactPhone;
    section.appendChild(phoneLine);
  }

  return section;
}

function buildNotesSection() {
  const section = document.createElement('section');
  section.className = 'notes';
  section.textContent = state.epkNotes;
  return section;
}

function buildSecondaryImageSection() {
  const section = document.createElement('section');
  section.className = 'secondary-image';
  if (state.secondaryImage.status === 'loading') {
    section.textContent = 'Loading image…';
  } else if (state.secondaryImage.dataUrl) {
    const img = document.createElement('img');
    img.src = state.secondaryImage.dataUrl;
    img.alt = `${state.artistName || 'Artist'} secondary image`;
    section.appendChild(img);
  } else {
    section.textContent = state.secondaryImage.error || 'Secondary image unavailable.';
  }
  return section;
}

function paginateSections(sections, pageHeightPx) {
  const pages = [];
  let currentPage = [];
  const measurePage = document.createElement('div');
  measurePage.className = 'press-page';
  measurePage.style.position = 'absolute';
  measurePage.style.visibility = 'hidden';
  measurePage.style.pointerEvents = 'none';
  measurePage.style.width = getComputedStyle(document.documentElement).getPropertyValue('--page-width');
  const inner = document.createElement('div');
  inner.className = 'press-page-content';
  measurePage.appendChild(inner);
  document.body.appendChild(measurePage);

  sections.forEach((section) => {
    const clone = section.cloneNode(true);
    inner.appendChild(clone);
    if (inner.scrollHeight <= pageHeightPx) {
      currentPage.push(section);
    } else {
      inner.removeChild(clone);
      if (currentPage.length) {
        pages.push(currentPage);
      }
      currentPage = [section];
      inner.textContent = '';
      inner.appendChild(section.cloneNode(true));
    }
  });

  if (currentPage.length) {
    pages.push(currentPage);
  }

  document.body.removeChild(measurePage);
  return pages;
}

function showToast(message, variant = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.variant = variant;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function openEmailModal() {
  emailForm.reset();
  clearEmailErrors();
  const subjectField = emailForm.querySelector('input[name="subject"]');
  subjectField.value = `Press Kit - ${state.artistName || 'Artist'} | Guttersville Records`;
  lastActiveElement = document.activeElement;
  emailModal.hidden = false;
  document.body.classList.add('modal-open');
  const toField = emailModal.querySelector('input[name="to"]');
  if (toField) {
    toField.focus();
  }
}

function closeEmailModal() {
  emailModal.hidden = true;
  document.body.classList.remove('modal-open');
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
  }
  lastActiveElement = null;
}

async function triggerPdfDownload() {
  try {
    setLoading(true);
    await waitForPendingImages();
    const { bytes, filename } = await buildPdfDocument();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('PDF downloaded');
  } catch (error) {
    console.error(error);
    showToast('Unable to build PDF. Try again or review troubleshooting.', 'error');
  } finally {
    setLoading(false);
  }
}

async function handleEmailSubmit(event) {
  event.preventDefault();
  const formData = new FormData(emailForm);
  const to = (formData.get('to') || '').trim();
  const cc = (formData.get('cc') || '').trim();
  const subject = (formData.get('subject') || '').trim();
  const message = (formData.get('message') || '').trim();

  clearEmailErrors();

  if (!to || !isValidEmail(to)) {
    setEmailError('email-to', 'Enter a valid recipient email.');
    return;
  }
  if (cc && !isValidEmail(cc)) {
    setEmailError('email-cc', 'Enter a valid CC email or leave blank.');
    return;
  }
  if (!subject) {
    setEmailError('email-subject', 'Subject is required.');
    return;
  }

  try {
    setLoading(true);
    await waitForPendingImages();
    const { bytes, filename } = await buildPdfDocument();
    const base64 = arrayBufferToBase64(bytes.buffer);
    const endpoint = window.APP_CONFIG?.emailEndpoint || '/.netlify/functions/sendEmail';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        cc,
        subject,
        message,
        filename,
        pdfBase64: base64,
        artistName: state.artistName,
        streamingUrl: state.streamingUrl,
        website: state.website,
        socialLinks: state.socialLinks,
        contactEmail: state.contactEmail,
        contactPhone: state.contactPhone,
      }),
    });

    if (!response.ok) {
      const payload = await safeJson(response);
      const errorMessage = payload?.error || `Email provider error (${response.status})`;
      throw new Error(errorMessage);
    }

    showToast('Email sent successfully');
    closeEmailModal();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Email failed to send.', 'error');
  } finally {
    setLoading(false);
  }
}

function clearEmailErrors() {
  ['email-to', 'email-cc', 'email-subject'].forEach((key) => setEmailError(key, ''));
}

function setEmailError(field, message) {
  const target = emailForm.querySelector(`[data-error-for="${field}"]`);
  if (target) {
    target.textContent = message;
  }
}

async function waitForPendingImages() {
  if (!state.pendingImagePromises.size) return;
  await Promise.allSettled(Array.from(state.pendingImagePromises));
}

async function buildPdfDocument() {
  await document.fonts.ready;
  renderPreview();
  const pages = Array.from(previewContainer.querySelectorAll('.press-page'));
  if (!pages.length) {
    throw new Error('Nothing to render');
  }
  const pageSize = PAGE_SIZES[state.pageSize] || PAGE_SIZES.letter;
  const previewWidthPx = pages[0].clientWidth;
  const scale = pageSize.widthPt / previewWidthPx;

  const images = [];
  const linkAnnotations = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageElement = pages[pageIndex];
    const canvas = await renderPageToCanvas(pageElement);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push({ dataUrl, widthPx: canvas.width, heightPx: canvas.height });
    const pageLinks = collectLinkAnnotations(pageElement, pageSize, scale);
    linkAnnotations.push(pageLinks);
  }

  const pdfBytes = createPdf({ images, pageSize, annotations: linkAnnotations });
  const filename = `guttersville-press-kit-${slugify(state.artistName || 'artist')}.pdf`;
  return { bytes: pdfBytes, filename };
}

function collectLinkAnnotations(pageElement, pageSize, scale) {
  const links = Array.from(pageElement.querySelectorAll('a[href]'));
  const annotations = [];
  const pageRect = pageElement.getBoundingClientRect();

  links.forEach((link) => {
    const rect = link.getBoundingClientRect();
    const x = (rect.left - pageRect.left) * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;
    const y = pageSize.heightPt - (rect.top - pageRect.top + rect.height) * scale;
    annotations.push({ x, y, width, height, url: link.href });
  });

  return annotations;
}

function inlineComputedStyles(element) {
  const clone = element.cloneNode(true);
  const queue = [[element, clone]];
  while (queue.length) {
    const [source, target] = queue.shift();
    const styles = getComputedStyle(source);
    const styleText = Array.from(styles)
      .map((prop) => `${prop}:${styles.getPropertyValue(prop)};`)
      .join('');
    target.setAttribute('style', styleText);
    Array.from(source.children).forEach((child, index) => {
      if (target.children[index]) {
        queue.push([child, target.children[index]]);
      }
    });
  }
  return clone;
}

async function renderPageToCanvas(pageElement) {
  const clone = inlineComputedStyles(pageElement);
  const width = pageElement.clientWidth;
  const height = pageElement.clientHeight;
  const serializer = new XMLSerializer();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${serializer.serializeToString(clone)}</foreignObject>
    </svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = await loadImage(url);
  const scaleFactor = window.devicePixelRatio > 1 ? 2 : 1.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * scaleFactor);
  canvas.height = Math.floor(height * scaleFactor);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scaleFactor, scaleFactor);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = src;
  });
}

function createPdf({ images, pageSize, annotations }) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let position = 0;

  const writeString = (str) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    position += bytes.length;
  };

  const writeBytes = (bytes) => {
    chunks.push(bytes);
    position += bytes.length;
  };

  const objects = [];
  const addObject = (writer) => {
    const number = objects.length + 1;
    objects.push({ number, writer });
    return number;
  };

  const pageObjectNumbers = [];
  let pagesObjectNumber = 0;

  const catalogNumber = addObject((ctx) => {
    ctx.writeString(`<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`);
  });

  pagesObjectNumber = addObject((ctx) => {
    const kids = pageObjectNumbers.map((num) => `${num} 0 R`).join(' ');
    ctx.writeString(`<< /Type /Pages /Kids [${kids}] /Count ${pageObjectNumbers.length} >>`);
  });

  images.forEach((image, pageIndex) => {
    const imageBytes = dataUrlToUint8(image.dataUrl);
    const imageObjectNumber = addObject((ctx) => {
      ctx.writeString(`<< /Type /XObject /Subtype /Image /Width ${image.widthPx} /Height ${image.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\n`);
      ctx.writeString('stream\n');
      ctx.writeBytes(imageBytes);
      ctx.writeString('\nendstream');
    });

    const contentStream = [
      'q',
      `${pageSize.widthPt.toFixed(2)} 0 0 ${pageSize.heightPt.toFixed(2)} 0 0 cm`,
      `/Im${pageIndex} Do`,
      'Q',
    ].join('\n');
    const contentBytes = encoder.encode(contentStream);
    const contentObjectNumber = addObject((ctx) => {
      ctx.writeString(`<< /Length ${contentBytes.length} >>\n`);
      ctx.writeString('stream\n');
      ctx.writeBytes(contentBytes);
      ctx.writeString('\nendstream');
    });

    const annotationNumbers = [];
    (annotations[pageIndex] || []).forEach(({ x, y, width, height, url }) => {
      const rect = [x, y, x + width, y + height]
        .map((value) => value.toFixed(2))
        .join(' ');
      const escapedUrl = escapePdfString(url);
      const annotationNumber = addObject((ctx) => {
        ctx.writeString(`<< /Type /Annot /Subtype /Link /Rect [${rect}] /Border [0 0 0] /A << /S /URI /URI (${escapedUrl}) >> >>`);
      });
      annotationNumbers.push(`${annotationNumber} 0 R`);
    });

    const pageObjectNumber = addObject((ctx) => {
      const resources = `<< /XObject << /Im${pageIndex} ${imageObjectNumber} 0 R >> >>`;
      const annots = annotationNumbers.length ? ` /Annots [${annotationNumbers.join(' ')}]` : '';
      ctx.writeString(`<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 ${pageSize.widthPt.toFixed(2)} ${pageSize.heightPt.toFixed(2)}] /Resources ${resources} /Contents ${contentObjectNumber} 0 R${annots} >>`);
    });

    pageObjectNumbers.push(pageObjectNumber);
  });

  writeString('%PDF-1.4\n%âãÏÓ\n');

  const writerContext = {
    writeString,
    writeBytes,
  };

  objects.forEach((object) => {
    offsets.push(position);
    writeString(`${object.number} 0 obj\n`);
    object.writer(writerContext);
    writeString('\nendobj\n');
  });

  const xrefOffset = position;
  writeString(`xref\n0 ${objects.length + 1}\n`);
  writeString('0000000000 65535 f \n');
  offsets.forEach((offset) => {
    const padded = offset.toString().padStart(10, '0');
    writeString(`${padded} 00000 n \n`);
  });
  writeString(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}
function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function escapePdfString(str) {
  return str.replace(/[\()]/g, (match) => `\${match}`);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artist';
}

function setLoading(isLoading) {
  loadingOverlay.hidden = !isLoading;
}

function handleCopyShareBlurb() {
  const artist = state.artistName || 'this artist';
  const streaming = state.streamingUrl ? `Listen: ${state.streamingUrl}` : '';
  const contactEmail = state.contactEmail ? `Email: ${state.contactEmail}` : '';
  const contactPhone = state.contactPhone ? `Phone: ${state.contactPhone}` : '';
  const parts = [`Press kit for ${artist}.`, streaming, contactEmail, contactPhone].filter(Boolean);
  const text = parts.join(' ');
  if (!text) {
    showToast('Add artist details before sharing', 'error');
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast('Share blurb copied'))
    .catch(() => showToast('Unable to copy. Copy manually instead.', 'error'));
}

function handleGlobalKeyDown(event) {
  if (emailModal.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeEmailModal();
    return;
  }
  if (event.key === "Tab") {
    trapFocus(event, emailModal);
  }
}

function trapFocus(event, container) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const focusable = Array.from(container.querySelectorAll(focusableSelectors.join(','))).filter(
    (el) => !el.hasAttribute('disabled')
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      last.focus();
      event.preventDefault();
    }
  } else {
    if (active === last) {
      first.focus();
      event.preventDefault();
    }
  }
}

function parseDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.size) return;
  const fields = [
    'artistName',
    'tagline',
    'bio',
    'genre',
    'location',
    'forFansOf',
    'streamingUrl',
    'website',
    'contactName',
    'contactEmail',
    'contactPhone',
    'epkNotes',
    'pageSize',
  ];
  let touched = false;
  fields.forEach((field) => {
    if (params.has(field)) {
      const value = params.get(field);
      const input = form.querySelector(`[name="${field}"]`);
      if (input) {
        if (input.tagName === 'TEXTAREA') {
          input.value = value;
        } else {
          input.value = value;
        }
        touched = true;
      }
    }
  });
  if (params.has('socialLinks')) {
    const socials = params.getAll('socialLinks');
    const textarea = form.querySelector('[name="socialLinks"]');
    if (textarea) {
      textarea.value = socials.join('\n');
      touched = true;
    }
  }
  if (params.has('pressPhotoUrl')) {
    const value = params.get('pressPhotoUrl');
    const input = form.querySelector('[name="pressPhotoUrl"]');
    if (input) {
      input.value = value;
      loadRemoteImage(value, state.pressPhoto, true);
      touched = true;
    }
  }
  if (params.has('secondaryImageUrl')) {
    const value = params.get('secondaryImageUrl');
    const input = form.querySelector('[name="secondaryImageUrl"]');
    if (input) {
      input.value = value;
      loadRemoteImage(value, state.secondaryImage, true);
      touched = true;
    }
  }
  if (params.has('logoUrl')) {
    const value = params.get('logoUrl');
    const input = form.querySelector('[name="logoUrl"]');
    if (input) {
      input.value = value;
      loadRemoteImage(value, state.logoOverride, true);
      touched = true;
    }
  }
  if (touched) {
    handleFormChange();
    showToast('Prefilled from shared link');
  }
}
