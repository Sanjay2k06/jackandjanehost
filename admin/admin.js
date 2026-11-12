const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const adminApp = document.querySelector("#admin-app");
const viewPanel = document.querySelector("#view-panel");
const notice = document.querySelector("#notice");
const saveButton = document.querySelector("#save-button");
const saveState = document.querySelector("#save-state");
const previewDialog = document.querySelector("#preview-dialog");
const previewFrame = document.querySelector("#preview-frame");
const deploymentCard = document.querySelector("#deployment-card");

let draft = null;
let version = null;
let currentView = "overview";
let dirty = false;
let saving = false;
let noticeTimer = 0;
const pendingUploads = new Map();
const previewUrls = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function requestJson(url, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    if (response.status === 401 && adminApp && !adminApp.hidden) {
      showLogin();
      loginMessage.textContent = result.error || "Your admin session has expired. Please sign in again.";
      loginMessage.hidden = false;
    }
    throw new Error(result.error || `The request failed (${response.status}).`);
  }
  return result;
}

function showNotice(message, kind = "success") {
  window.clearTimeout(noticeTimer);
  notice.dataset.kind = kind;
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = window.setTimeout(() => { notice.hidden = true; }, kind === "error" ? 9000 : 6500);
}

function setDirty() {
  dirty = true;
  saveState.textContent = "Unsaved changes";
  saveState.dataset.dirty = "true";
  saveButton.disabled = saving;
}

function setClean() {
  dirty = false;
  saveState.textContent = "All changes saved";
  delete saveState.dataset.dirty;
  saveButton.disabled = true;
}

function showLogin() {
  adminApp.hidden = true;
  loginScreen.hidden = false;
  loginForm.reset();
  document.querySelector("#login-username").focus();
}

function showApp() {
  loginScreen.hidden = true;
  adminApp.hidden = false;
}

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function pageHeading(title, description, actionText, actionName) {
  const heading = document.createElement("div");
  heading.className = "page-heading";
  const copy = document.createElement("div");
  addText(copy, "h1", title);
  addText(copy, "p", description);
  heading.append(copy);
  if (actionText) {
    const action = document.createElement("button");
    action.className = "button button--primary";
    action.type = "button";
    action.dataset.action = actionName;
    action.textContent = actionText;
    heading.append(action);
  }
  viewPanel.append(heading);
}

function card(title, description) {
  const element = document.createElement("section");
  element.className = "editor-card";
  const header = document.createElement("div");
  header.className = "editor-card-header";
  const copy = document.createElement("div");
  addText(copy, "h2", title);
  if (description) addText(copy, "p", description);
  header.append(copy);
  element.append(header);
  return element;
}

function field(parent, label, value, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = `field${options.wide ? " field--wide" : ""}`;
  addText(wrapper, "span", label, "field-label");
  const control = options.multiline ? document.createElement("textarea") : document.createElement("input");
  if (options.multiline) control.className = "field-textarea";
  else {
    control.className = "field-input";
    control.type = options.type || "text";
  }
  if (options.path) control.dataset.path = options.path;
  if (options.branch !== undefined) control.dataset.branch = `${options.branch}.${options.key}`;
  if (options.imageId) control.dataset.image = `${options.imageId}.${options.key}`;
  if (options.lines) control.dataset.lines = "true";
  if (options.multiline) {
    control.value = options.lines ? value.join("\n") : value;
    if (options.tall) control.dataset.multiline = "true";
  } else {
    control.value = value == null ? "" : value;
    if (options.step) control.step = options.step;
  }
  if (options.placeholder) control.placeholder = options.placeholder;
  if (options.type === "number") control.inputMode = "numeric";
  wrapper.append(control);
  if (options.help) addText(wrapper, "span", options.help, "field-help");
  parent.append(wrapper);
  return control;
}

function checkbox(parent, label, checked, dataset) {
  const wrapper = document.createElement("label");
  wrapper.className = "check-field";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  Object.assign(input.dataset, dataset);
  wrapper.append(input, document.createTextNode(label));
  parent.append(wrapper);
}

function renderOverview() {
  pageHeading("Overview", "Manage the content visitors see on the Jack & Jane website.");
  const stats = document.createElement("div");
  stats.className = "overview-grid";
  [
    ["Visible branches", draft.branches.filter((item) => item.visible).length],
    ["Published photos", draft.gallery.filter((item) => item.visible).length],
    ["Services", draft.content.services.length],
  ].forEach(([label, value]) => {
    const stat = document.createElement("section");
    stat.className = "stat-card";
    addText(stat, "span", label);
    addText(stat, "strong", String(value));
    stats.append(stat);
  });
  viewPanel.append(stats);

  const summary = document.createElement("section");
  summary.className = "panel-card";
  addText(summary, "h2", "Your website content");
  addText(summary, "p", "Updates are committed to GitHub only after you choose Save changes.");
  const list = document.createElement("ul");
  list.className = "overview-list";
  [
    ["Hero and about", "Edit the landing message and company introduction", "website"],
    ["Services", "Update program names, descriptions and icons", "website"],
    ["Branches", "Manage locations, contact details and visibility", "branches"],
    ["Photo gallery", "Upload, caption, order and publish photos", "gallery"],
  ].forEach(([title, detail, destination]) => {
    const row = document.createElement("li");
    addText(row, "strong", title);
    addText(row, "span", detail);
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.addEventListener("click", () => navigate(destination));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") navigate(destination);
    });
    list.append(row);
  });
  summary.append(list);
  viewPanel.append(summary);

  const notes = document.createElement("section");
  notes.className = "panel-card";
  addText(notes, "h2", "Publishing");
  addText(notes, "p", "Preview is private to this browser session. Saving creates one GitHub commit; Vercel then builds and publishes the updated site.");
  viewPanel.append(notes);
}

function renderContent() {
  pageHeading("Website content", "Edit existing page copy, contact information, services and footer details.");

  const company = card("Company information", "The public brand name and location.");
  const companyGrid = document.createElement("div");
  companyGrid.className = "field-grid";
  field(companyGrid, "Short name", draft.content.company.name, { path: "company.name" });
  field(companyGrid, "Full name", draft.content.company.fullName, { path: "company.fullName" });
  field(companyGrid, "Location", draft.content.company.location, { path: "company.location" });
  company.append(companyGrid);
  viewPanel.append(company);

  const hero = card("Hero section", "The first message visitors see.");
  const heroGrid = document.createElement("div");
  heroGrid.className = "field-grid";
  field(heroGrid, "First heading line", draft.content.hero.heading, { path: "hero.heading" });
  field(heroGrid, "Highlighted heading line", draft.content.hero.emphasis, { path: "hero.emphasis" });
  field(heroGrid, "Description", draft.content.hero.description, { path: "hero.description", multiline: true, wide: true });
  field(heroGrid, "Sign-off", draft.content.hero.tagline, { path: "hero.tagline" });
  hero.append(heroGrid);
  viewPanel.append(hero);

  const about = card("About section", "The existing introduction and value statements.");
  const aboutGrid = document.createElement("div");
  aboutGrid.className = "field-grid";
  field(aboutGrid, "Eyebrow", draft.content.about.eyebrow, { path: "about.eyebrow" });
  field(aboutGrid, "Heading", draft.content.about.heading, { path: "about.heading" });
  field(aboutGrid, "Highlighted heading", draft.content.about.emphasis, { path: "about.emphasis" });
  draft.content.about.paragraphs.forEach((value, index) => {
    field(aboutGrid, `Paragraph ${index + 1}`, value, { path: `about.paragraphs.${index}`, multiline: true, wide: true });
  });
  field(aboutGrid, "Value chips (one per line)", draft.content.about.values, { path: "about.values", multiline: true, wide: true, lines: true });
  about.append(aboutGrid);
  viewPanel.append(about);

  const services = card("Services", "Manage the services shown in the programs section.");
  const serviceList = document.createElement("div");
  serviceList.className = "list-editor";
  draft.content.services.forEach((service, index) => {
    const editor = document.createElement("div");
    editor.className = "service-editor";
    const header = document.createElement("div");
    header.className = "service-editor-header";
    addText(header, "strong", `Service ${index + 1}`);
    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.type = "button";
    remove.dataset.action = "remove-service";
    remove.dataset.index = String(index);
    remove.textContent = "Remove";
    header.append(remove);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    field(grid, "Service title", service.title, { path: `services.${index}.title` });
    const symbolWrap = document.createElement("label");
    symbolWrap.className = "field";
    addText(symbolWrap, "span", "Icon", "field-label");
    const symbol = document.createElement("select");
    symbol.className = "field-select";
    symbol.dataset.path = `services.${index}.symbol`;
    ["arrow-up-right", "sparkle", "speech", "play", "sensory", "home", "heart", "sun"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.replace(/-/g, " ");
      option.selected = service.symbol === value;
      symbol.append(option);
    });
    symbolWrap.append(symbol);
    grid.append(symbolWrap);
    field(grid, "Description", service.description, { path: `services.${index}.description`, multiline: true, wide: true });
    editor.append(header, grid);
    serviceList.append(editor);
  });
  services.append(serviceList);
  const addService = document.createElement("button");
  addService.className = "add-button";
  addService.type = "button";
  addService.dataset.action = "add-service";
  addService.textContent = "Add a service";
  services.append(addService);
  viewPanel.append(services);

  const contact = card("Contact information", "Details used in the contact section and enquiry links.");
  const contactGrid = document.createElement("div");
  contactGrid.className = "field-grid";
  field(contactGrid, "Phone", draft.content.contact.phone, { path: "contact.phone" });
  field(contactGrid, "Email", draft.content.contact.email, { path: "contact.email" });
  field(contactGrid, "WhatsApp number (digits only)", draft.content.contact.whatsappNumber, { path: "contact.whatsappNumber" });
  field(contactGrid, "Introduction", draft.content.contact.intro, { path: "contact.intro", multiline: true, wide: true });
  field(contactGrid, "Google Maps link", draft.content.contact.mapUrl, { path: "contact.mapUrl", wide: true });
  field(contactGrid, "Map embed URL", draft.content.contact.mapEmbedUrl, { path: "contact.mapEmbedUrl", wide: true });
  contact.append(contactGrid);
  viewPanel.append(contact);

  const footer = card("Footer", "Closing message and belief statements.");
  const footerGrid = document.createElement("div");
  footerGrid.className = "field-grid";
  field(footerGrid, "Tagline", draft.content.footer.tagline, { path: "footer.tagline" });
  field(footerGrid, "Belief lines (one per line)", draft.content.footer.beliefLines, { path: "footer.beliefLines", multiline: true, lines: true });
  field(footerGrid, "Closing text", draft.content.footer.closing, { path: "footer.closing", wide: true });
  footer.append(footerGrid);
  viewPanel.append(footer);
}

function renderBranches() {
  pageHeading("Branches", "Add locations, keep contact details current, and control which branches appear publicly.", "Add branch", "add-branch");
  const list = document.createElement("div");
  list.className = "branches-list";
  draft.branches.slice().sort((a, b) => a.order - b.order).forEach((branch) => {
    const index = draft.branches.indexOf(branch);
    const editor = document.createElement("section");
    editor.className = "branch-editor";
    const header = document.createElement("div");
    header.className = "branch-editor-header";
    const title = document.createElement("div");
    addText(title, "h2", branch.name || "New branch");
    addText(title, "p", `Display position ${branch.order}`);
    header.append(title);
    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.type = "button";
    remove.dataset.action = "remove-branch";
    remove.dataset.index = String(index);
    remove.textContent = "Delete branch";
    header.append(remove);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    [
      ["Branch name", "name"], ["Card heading", "title"], ["Complete address", "address"],
      ["Landmark", "landmark"], ["Phone", "phone"], ["Email", "email"],
      ["Google Maps link", "mapsUrl"], ["Opening hours", "hours"], ["Status", "status"],
      ["Display order", "order"],
    ].forEach(([label, key]) => {
      field(grid, label, branch[key], { branch: index, key, type: key === "order" ? "number" : "text", step: "1" });
    });
    field(grid, "Coming-soon description", branch.description || "", { branch: index, key: "description", multiline: true, wide: true });
    const options = document.createElement("div");
    options.className = "branch-options";
    checkbox(options, "Visible on the public website", branch.visible, { branch: String(index), key: "visible", type: "branch-check" });
    checkbox(options, "Coming soon", branch.comingSoon, { branch: String(index), key: "comingSoon", type: "branch-check" });
    checkbox(options, "Featured branch", branch.featured, { branch: String(index), key: "featured", type: "branch-check" });
    editor.append(header, grid, options);
    list.append(editor);
  });
  viewPanel.append(list);
}

function assetUrl(path) {
  if (typeof path !== "string" || !/^(?:imagees|assets\/gallery)\//.test(path)) return "";
  return `/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function renderGallery() {
  pageHeading("Photo gallery", "Upload an optimized photo, write a caption, and choose whether it is public.", "Upload a photo", "add-photo");
  const list = document.createElement("div");
  list.className = "gallery-list";
  draft.gallery.slice().sort((a, b) => a.order - b.order).forEach((image) => {
    const index = draft.gallery.indexOf(image);
    const editor = document.createElement("section");
    editor.className = "gallery-editor";
    const preview = document.createElement("div");
    preview.className = "gallery-preview";
    const localUrl = previewUrls.get(image.id);
    if (localUrl || assetUrl(image.src)) {
      const img = document.createElement("img");
      img.src = localUrl || assetUrl(image.src);
      img.alt = image.description || "";
      preview.append(img);
    } else {
      addText(preview, "span", "Choose a photo to preview it here.");
    }
    const fields = document.createElement("div");
    fields.className = "gallery-fields";
    const header = document.createElement("div");
    header.className = "branch-editor-header";
    const heading = document.createElement("div");
    addText(heading, "h2", image.title || "New photo");
    addText(heading, "p", `Display position ${image.order}`);
    const remove = document.createElement("button");
    remove.className = "danger-button";
    remove.type = "button";
    remove.dataset.action = "remove-image";
    remove.dataset.index = String(index);
    remove.textContent = "Delete photo";
    header.append(heading, remove);
    fields.append(header);
    field(fields, "Image title", image.title, { imageId: image.id, key: "title" });
    field(fields, "Description / alternative text", image.description, { imageId: image.id, key: "description", multiline: true });
    const orderRow = document.createElement("div");
    orderRow.className = "field-grid";
    field(orderRow, "Display order", image.order, { imageId: image.id, key: "order", type: "number", step: "1" });
    checkbox(orderRow, "Show on public website", image.visible, { image: image.id, key: "visible", type: "gallery-check" });
    fields.append(orderRow);
    const actions = document.createElement("div");
    actions.className = "gallery-actions";
    const fileLabel = document.createElement("label");
    fileLabel.className = "file-button";
    fileLabel.textContent = image.src ? "Replace photo" : "Choose photo";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.dataset.imageFile = image.id;
    fileLabel.append(input);
    actions.append(fileLabel);
    fields.append(actions);
    editor.append(preview, fields);
    list.append(editor);
  });
  viewPanel.append(list);
  addText(viewPanel, "p", "Photos are resized and converted in your browser before upload. Accepted formats: JPEG, PNG or WebP; maximum source size 12 MB and optimized total 2.5 MB per save.", "gallery-note");
}

function renderView() {
  if (!draft) return;
  viewPanel.replaceChildren();
  const titles = { overview: "Overview", website: "Website content", branches: "Branches", gallery: "Photo gallery" };
  document.querySelector("#view-title").textContent = titles[currentView];
  document.querySelectorAll(".side-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.view === currentView);
  });
  if (currentView === "overview") renderOverview();
  if (currentView === "website") renderContent();
  if (currentView === "branches") renderBranches();
  if (currentView === "gallery") renderGallery();
}

function navigate(view) {
  currentView = view;
  document.querySelector("#sidebar").classList.remove("is-open");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
  renderView();
}

function setValueAtPath(object, path, value) {
  const segments = path.split(".");
  const key = segments.pop();
  const parent = segments.reduce((current, segment) => current[segment], object);
  parent[key] = value;
}

function updateBranchField(input) {
  const [index, key] = input.dataset.branch.split(".");
  draft.branches[Number(index)][key] = key === "order" ? Number(input.value) : input.value;
}

function updateGalleryField(input) {
  const [id, key] = input.dataset.image.split(".");
  const image = draft.gallery.find((entry) => entry.id === id);
  if (image) image[key] = key === "order" ? Number(input.value) : input.value;
}

function createBranch() {
  const branch = {
    id: `branch-${crypto.randomUUID().toLowerCase()}`,
    name: "New branch",
    title: draft.content.company.fullName,
    address: "",
    landmark: "",
    phone: draft.content.contact.phone,
    email: draft.content.contact.email,
    mapsUrl: "",
    hours: "",
    status: "Open",
    description: "",
    visible: true,
    order: draft.branches.length + 1,
    featured: false,
    comingSoon: false,
    image: "",
  };
  draft.branches.push(branch);
  setDirty();
  renderView();
}

function deleteBranch(index) {
  const branch = draft.branches[index];
  if (!branch || !window.confirm(`Delete the ${branch.name} branch? This change will be published when you save.`)) return;
  draft.branches.splice(index, 1);
  draft.branches.forEach((entry, order) => { entry.order = order + 1; });
  setDirty();
  renderView();
}

function chooseFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) addGalleryImage(input.files[0]);
  }, { once: true });
  input.click();
}

function requestReplacement(id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp";
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) replaceGalleryImage(id, input.files[0]);
  }, { once: true });
  input.click();
}

async function optimizeImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }
  if (file.size > 12_000_000) throw new Error("The selected image is larger than 12 MB.");
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image optimization is not available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = null;
  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= 1_200_000) break;
  }
  if (!blob || blob.size > 1_200_000) throw new Error("This image could not be optimized below 1.2 MB. Choose a smaller image.");
  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    data: encodeBase64(bytes),
    bytes: bytes.byteLength,
    extension,
    previewUrl: URL.createObjectURL(blob),
  };
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The selected image could not be optimized."));
    }, "image/webp", quality);
  });
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function stageImage(id, optimized) {
  const currentTotal = Array.from(pendingUploads.entries())
    .reduce((sum, [pendingId, upload]) => sum + (pendingId === id ? 0 : upload.bytes), 0);
  if (currentTotal + optimized.bytes > 2_500_000) {
    URL.revokeObjectURL(optimized.previewUrl);
    throw new Error("Optimized photos must total no more than 2.5 MB per save.");
  }
  const image = draft.gallery.find((entry) => entry.id === id);
  if (!image) throw new Error("The selected gallery item is no longer available.");
  const previousUrl = previewUrls.get(id);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  image.src = `assets/gallery/${id}.${optimized.extension}`;
  previewUrls.set(id, optimized.previewUrl);
  pendingUploads.set(id, { data: optimized.data, bytes: optimized.bytes });
  setDirty();
  renderView();
}

async function addGalleryImage(file) {
  try {
    const optimized = await optimizeImage(file);
    const id = `photo-${crypto.randomUUID().toLowerCase()}`;
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "New photo";
    const image = {
      id,
      src: "",
      title: name,
      description: name,
      visible: true,
      order: draft.gallery.length + 1,
    };
    draft.gallery.push(image);
    try {
      stageImage(id, optimized);
    } catch (error) {
      draft.gallery.pop();
      throw error;
    }
    showNotice("Photo optimized and staged. Save changes to publish it.");
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function replaceGalleryImage(id, file) {
  try {
    const optimized = await optimizeImage(file);
    stageImage(id, optimized);
    showNotice("Replacement photo optimized and staged. Save changes to publish it.");
  } catch (error) {
    showNotice(error.message, "error");
  }
}

function deleteGalleryImage(index) {
  const image = draft.gallery[index];
  if (!image || !window.confirm(`Delete “${image.title}” from the public gallery? This change will be published when you save.`)) return;
  draft.gallery.splice(index, 1);
  const upload = pendingUploads.get(image.id);
  if (upload) pendingUploads.delete(image.id);
  const preview = previewUrls.get(image.id);
  if (preview) URL.revokeObjectURL(preview);
  previewUrls.delete(image.id);
  draft.gallery.forEach((entry, order) => { entry.order = order + 1; });
  setDirty();
  renderView();
}

function validateDraft() {
  if (!draft.content.company.name.trim() || !draft.content.company.fullName.trim()) throw new Error("Add the company name and full name.");
  if (!draft.content.services.length) throw new Error("Add at least one service.");
  const branchIds = new Set();
  for (const branch of draft.branches) {
    if (!branch.id || branchIds.has(branch.id)) throw new Error("Branch IDs must be unique.");
    branchIds.add(branch.id);
    if (!branch.name.trim() || !branch.title.trim() || !branch.phone.trim() || !branch.email.trim()) {
      throw new Error("Each branch needs a name, heading, phone and email.");
    }
  }
  const imageIds = new Set();
  for (const image of draft.gallery) {
    if (!image.id || imageIds.has(image.id)) throw new Error("Gallery image IDs must be unique.");
    imageIds.add(image.id);
    if (!image.src || !image.title.trim() || !image.description.trim()) {
      throw new Error("Each gallery photo needs an image, title and description.");
    }
    if (image.src.startsWith("assets/gallery/") && !pendingUploads.has(image.id)
      && !version) {
      throw new Error("Reload the dashboard before saving gallery photos.");
    }
  }
}

function setSaving(value) {
  saving = value;
  saveButton.disabled = value || !dirty;
  saveButton.textContent = value ? "Saving…" : "Save changes";
}

async function saveChanges() {
  if (!draft || saving || !dirty) return;
  try {
    validateDraft();
  } catch (error) {
    showNotice(error.message, "error");
    return;
  }
  setSaving(true);
  saveState.textContent = "Saving to GitHub…";
  try {
    const result = await requestJson("/api/admin/content", {
      method: "PUT",
      body: {
        content: draft.content,
        branches: draft.branches,
        gallery: draft.gallery,
        uploads: Array.from(pendingUploads, ([id, upload]) => ({ id, data: upload.data })),
        version,
      },
    });
    setClean();
    if (result.unchanged) {
      showNotice(result.message || "There are no changes to publish.");
      return;
    }
    const commit = result.commit;
    if (!/^[a-f0-9]{40}$/i.test(commit || "")) {
      throw new Error("The save response did not include a confirmed GitHub commit SHA.");
    }
    showNotice(`GitHub confirmed commit ${commit.slice(0, 7)}. Checking the Vercel deployment…`);
    clearStagedPhotos();
    deploymentCard.hidden = false;
    deploymentCard.dataset.state = "WAITING";
    document.querySelector("#deployment-title").textContent = "Deployment in progress";
    document.querySelector("#deployment-message").textContent = "GitHub confirmed the commit. Checking Vercel for its deployment.";
    document.querySelector("#deployment-link").hidden = true;
    renderView();
    await reloadAfterSave();
    pollDeployment(commit);
  } catch (error) {
    showNotice(error.message, "error");
    saveState.textContent = dirty ? "Unsaved changes" : "All changes saved";
  } finally {
    setSaving(false);
  }
}

function clearStagedPhotos() {
  pendingUploads.clear();
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.clear();
}

async function reloadAfterSave() {
  try {
    const result = await requestJson("/api/admin/content");
    draft = { content: result.content, branches: result.branches, gallery: result.gallery };
    version = result.version;
    renderView();
  } catch (error) {
    showNotice(`GitHub confirmed the commit, but the latest content could not be reloaded: ${error.message}`, "warning");
  }
}

async function pollDeployment(commit) {
  const title = document.querySelector("#deployment-title");
  const message = document.querySelector("#deployment-message");
  const link = document.querySelector("#deployment-link");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const status = await requestJson(`/api/admin/deployment?commit=${encodeURIComponent(commit)}`);
      deploymentCard.dataset.state = status.state;
      title.textContent = status.state === "READY" ? "Deployment ready"
        : status.state === "ERROR" ? "Deployment failed"
          : status.state === "CANCELED" ? "Deployment canceled" : "Deployment in progress";
      message.textContent = status.message;
      if (status.url) {
        link.href = `https://${status.url}`;
        link.hidden = false;
      }
      if (["READY", "ERROR", "CANCELED"].includes(status.state)) return;
    } catch (error) {
      deploymentCard.dataset.state = "UNKNOWN";
      title.textContent = "Deployment status unavailable";
      message.textContent = `The GitHub commit succeeded, but Vercel status could not be checked: ${error.message}`;
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 4000));
  }
  title.textContent = "Deployment still in progress";
  message.textContent = "Vercel has not reported a final status yet. Check the Vercel dashboard for the latest build.";
}

function openPreview() {
  if (!draft) return;
  previewDialog.showModal();
  previewFrame.src = `/?admin-preview=1&preview=${Date.now()}`;
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin
    || event.source !== previewFrame.contentWindow
    || !event.data
    || event.data.type !== "jack-jane-preview-ready"
    || !draft) return;
  previewFrame.contentWindow.postMessage({
    type: "jack-jane-admin-preview",
    content: draft.content,
    branches: draft.branches,
    gallery: draft.gallery,
    previewAssets: Object.fromEntries(previewUrls),
  }, window.location.origin);
});

async function loadDashboard() {
  const result = await requestJson("/api/admin/content");
  draft = { content: result.content, branches: result.branches, gallery: result.gallery };
  version = result.version;
  setClean();
  renderView();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  loginMessage.hidden = true;
  try {
    const data = new FormData(loginForm);
    await requestJson("/api/auth/login", {
      method: "POST",
      body: { username: data.get("username"), password: data.get("password") },
    });
    showApp();
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.hidden = false;
    return;
  } finally {
    button.disabled = false;
  }
  try {
    await loadDashboard();
  } catch (error) {
    showNotice(error.message, "error");
  }
});

document.querySelectorAll(".side-link").forEach((link) => {
  link.addEventListener("click", () => navigate(link.dataset.view));
});

viewPanel.addEventListener("input", (event) => {
  const input = event.target;
  if (input.type === "checkbox" || input.type === "file") return;
  if (input.dataset.path) {
    let value = input.value;
    if (input.dataset.lines) value = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    setValueAtPath(draft.content, input.dataset.path, value);
    setDirty();
    return;
  }
  if (input.dataset.branch) {
    updateBranchField(input);
    const [index] = input.dataset.branch.split(".");
    const editor = input.closest(".branch-editor");
    editor.querySelector("h2").textContent = draft.branches[Number(index)].name || "New branch";
    editor.querySelector(".branch-editor-header p").textContent = `Display position ${draft.branches[Number(index)].order}`;
    setDirty();
    return;
  }
  if (input.dataset.image) {
    updateGalleryField(input);
    input.closest(".gallery-editor").querySelector(".branch-editor-header p").textContent = `Display position ${draft.gallery.find((image) => image.id === input.dataset.image.split(".")[0]).order}`;
    setDirty();
  }
});

viewPanel.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.type === "branch-check") {
    const [index, key] = input.dataset.branch.split(".");
    draft.branches[Number(index)][key] = input.checked;
    setDirty();
    return;
  }
  if (input.dataset.type === "gallery-check") {
    const image = draft.gallery.find((entry) => entry.id === input.dataset.image);
    if (image) image.visible = input.checked;
    setDirty();
    return;
  }
  if (input.dataset.imageFile && input.files && input.files[0]) {
    replaceGalleryImage(input.dataset.imageFile, input.files[0]);
    return;
  }
  if (input.dataset.path) {
    setValueAtPath(draft.content, input.dataset.path, input.value);
    setDirty();
  }
});

viewPanel.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "add-branch") createBranch();
  if (action.dataset.action === "remove-branch") deleteBranch(Number(action.dataset.index));
  if (action.dataset.action === "add-service") {
    draft.content.services.push({ title: "New service", description: "Add a service description.", symbol: "arrow-up-right" });
    setDirty();
    renderView();
  }
  if (action.dataset.action === "remove-service") {
    if (!window.confirm("Remove this service? This change will be published when you save.")) return;
    draft.content.services.splice(Number(action.dataset.index), 1);
    setDirty();
    renderView();
  }
  if (action.dataset.action === "add-photo") chooseFile();
  if (action.dataset.action === "remove-image") deleteGalleryImage(Number(action.dataset.index));
});

viewPanel.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.path && input.tagName === "SELECT") {
    setValueAtPath(draft.content, input.dataset.path, input.value);
    setDirty();
  }
});

document.querySelector("#mobile-menu").addEventListener("click", (event) => {
  const sidebar = document.querySelector("#sidebar");
  const isOpen = sidebar.classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  event.currentTarget.setAttribute("aria-label", isOpen ? "Close dashboard navigation" : "Open dashboard navigation");
});
document.querySelector("#save-button").addEventListener("click", saveChanges);
document.querySelector("#preview-button").addEventListener("click", openPreview);
document.querySelector("#close-preview").addEventListener("click", () => previewDialog.close());
previewDialog.addEventListener("click", (event) => {
  if (event.target === previewDialog) previewDialog.close();
});
document.querySelector("#logout-button").addEventListener("click", async () => {
  if (dirty && !window.confirm("You have unsaved changes. Log out and discard them?")) return;
  try {
    await requestJson("/api/auth/logout", { method: "POST", body: {} });
    clearStagedPhotos();
    draft = null;
    version = null;
    setClean();
    showLogin();
  } catch (error) {
    showNotice(error.message, "error");
  }
});

requestJson("/api/auth/session").then((session) => {
  if (!session.authenticated) {
    showLogin();
    return;
  }
  showApp();
  return loadDashboard().catch((error) => {
    showNotice(error.message, "error");
    document.querySelector("#view-title").textContent = "Could not load content";
  });
}).catch((error) => {
  showLogin();
  loginMessage.textContent = error.message;
  loginMessage.hidden = false;
});
