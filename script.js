const programs = [
  {
    title: "Behaviour Modification Program",
    description: "Our Behaviour Modification Program helps children develop positive behaviours and reduce challenging behaviours through structured, individualised strategies. The program focuses on improving attention, communication, social behaviour, emotional regulation, and daily routines.",
    symbol: "arrow-up-right",
  },
  {
    title: "IQ Enhancement Program",
    description: "Our IQ Enhancement Program is designed to strengthen cognitive abilities such as attention, memory, logical thinking, problem-solving, reasoning, and learning skills through age-appropriate and engaging activities.",
    symbol: "sparkle",
  },
  {
    title: "Speech & Communication Support",
    description: "We support children in developing functional communication, vocabulary, listening skills, understanding, expression, and social communication. Activities are planned according to each child's individual communication needs.",
    symbol: "speech",
  },
  {
    title: "Play Therapy",
    description: "Play Therapy provides children with a safe and engaging environment to express themselves, develop social interaction, improve communication, build confidence, and learn through play-based activities.",
    symbol: "play",
  },
  {
    title: "Early Intervention Program",
    description: "Our Early Intervention Program focuses on developing essential developmental skills during the early years. Activities may include fine motor skills, gross motor skills, sensory activities, attention, imitation, communication, and Activities of Daily Living (ADL).",
    symbol: "arrow-up-right",
  },
  {
    title: "Sensory Integration & Developmental Activities",
    description: "Sensory-based activities help children improve body awareness, attention, coordination, regulation, and participation in daily activities through structured and meaningful experiences.",
    symbol: "sensory",
  },
  {
    title: "School Readiness Program",
    description: "Our School Readiness Program prepares children for a successful transition to school by developing pre-writing, handwriting, early reading, attention, classroom behaviour, following instructions, and independent learning skills.",
    symbol: "home",
  },
  {
    title: "Social Skills Training",
    description: "We help children develop essential social skills such as sharing, turn-taking, greetings, eye contact, waiting, following social rules, initiating interaction, and participating appropriately with peers.",
    symbol: "heart",
  },
  {
    title: "Parent Counselling & Guidance",
    description: "We provide parents with practical guidance and strategies to understand their child's behaviour, communication, developmental needs, and learning patterns, helping them support their child's progress at home.",
    symbol: "sun",
  },
];

const supportAreas = [
  "Autism Spectrum Disorder (ASD)",
  "ADHD",
  "Developmental Delays",
  "Learning Difficulties",
  "Intellectual Disabilities",
  "Speech & Communication Difficulties",
  "Behavioural Challenges",
  "Sensory Processing Difficulties",
];

const approachSteps = [
  ["01", "Understand", "Learn about the child's individual needs, strengths, interests, and developmental goals."],
  ["02", "Individualise", "Plan suitable activities and support strategies based on the child's needs."],
  ["03", "Practise & Learn", "Encourage learning through structured activities, play, communication, and meaningful experiences."],
  ["04", "Partner With Parents", "Share practical guidance so parents can reinforce appropriate learning and daily-living skills at home."],
];

const principles = [
  ["sparkle", "Individual Attention", "Support shaped around each child's individual needs and strengths."],
  ["arrow-up-right", "Meaningful Learning", "Activities designed to encourage communication, participation, and everyday developmental skills."],
  ["heart", "Parent Partnership", "Practical guidance that helps families understand and support their child's learning."],
  ["sensory", "A Welcoming Environment", "A warm, encouraging space where children can learn and participate at their own pace."],
];

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

const programGrid = document.querySelector("#program-grid");
const supportList = document.querySelector("#support-list");
const stepsGrid = document.querySelector("#steps-grid");
const principleGrid = document.querySelector("#principle-grid");
const programSelect = document.querySelector("#program-select");

programGrid.innerHTML = programs.map((program, index) => `
  <article class="program-card reveal">
    <div class="program-head"><span class="program-symbol">${icon(program.symbol)}</span><span class="program-number">0${index + 1} / 09</span></div>
    <h3>${program.title}</h3>
    <p>${program.description}</p>
    <a class="text-link text-link--green" href="#contact" data-interest="${program.title}">Make an enquiry ${icon("arrow-up-right")}</a>
  </article>
`).join("");

supportList.innerHTML = supportAreas.map((area, index) => `
  <div class="support-item reveal"><span class="support-icon">${icon(["heart", "arrow-up-right", "sparkle", "home"][index % 4])}</span><span>${area}</span></div>
`).join("");

stepsGrid.innerHTML = approachSteps.map(([number, title, description]) => `
  <article class="step-card reveal"><span class="step-number">${number}</span><h3>${title}</h3><p>${description}</p></article>
`).join("");

principleGrid.innerHTML = principles.map(([symbol, title, description]) => `
  <article class="principle-card reveal"><span class="principle-symbol">${icon(symbol)}</span><h3>${title}</h3><p>${description}</p></article>
`).join("");

programSelect.insertAdjacentHTML("beforeend", programs.map(({ title }) => `<option>${title}</option>`).join(""));

const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector("#primary-menu");
const siteHeader = document.querySelector(".site-header");

function updateHeaderSurface() {
  siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);
}

updateHeaderSurface();
window.addEventListener("scroll", updateHeaderSurface, { passive: true });

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation menu");
  navMenu.classList.remove("is-open");
  document.body.classList.remove("menu-open");
}

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation menu" : "Close navigation menu");
  navMenu.classList.toggle("is-open", !isExpanded);
  document.body.classList.toggle("menu-open", !isExpanded);
});

navMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const revealElements = document.querySelectorAll(".reveal");
revealElements.forEach((element) => {
  const revealSiblings = Array.from(element.parentElement.children)
    .filter((sibling) => sibling.classList.contains("reveal"));
  const siblingIndex = revealSiblings.indexOf(element);
  element.style.setProperty("--reveal-delay", `${Math.min(siblingIndex * 75, 525)}ms`);
});

const splitHeadings = document.querySelectorAll("main h1, main h2");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  splitHeadings.forEach((heading) => {
    let wordIndex = 0;
    const accessibleText = heading.textContent.replace(/\s+/g, " ").trim();
    const textWalker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (textWalker.nextNode()) textNodes.push(textWalker.currentNode);

    textNodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      textNode.textContent.split(/(\s+)/).forEach((part) => {
        if (!part || /^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }

        const word = document.createElement("span");
        word.className = "split-word";
        word.setAttribute("aria-hidden", "true");
        word.style.setProperty("--word-delay", `${Math.min(wordIndex * 45, 540)}ms`);
        word.textContent = part;
        fragment.append(word);
        wordIndex += 1;
      });
      textNode.replaceWith(fragment);
    });

    heading.classList.add("split-heading");
    heading.setAttribute("aria-label", accessibleText);
  });

  if ("IntersectionObserver" in window) {
    const splitObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-split-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -20px 0px" });
    splitHeadings.forEach((heading) => splitObserver.observe(heading));
  } else {
    splitHeadings.forEach((heading) => heading.classList.add("is-split-visible"));
  }
}

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches
  && window.matchMedia("(min-width: 761px)").matches) {
  const centreImages = document.querySelectorAll("#centres .branch-image > img");
  let parallaxFrame = 0;

  function updateCentreParallax() {
    parallaxFrame = 0;
    const viewportHeight = window.innerHeight;
    centreImages.forEach((image) => {
      const bounds = image.parentElement.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > viewportHeight) return;
      const distanceFromCentre = (bounds.top + bounds.height / 2 - viewportHeight / 2) / (viewportHeight * 0.75);
      const offset = Math.max(-1, Math.min(1, distanceFromCentre)) * -8;
      image.style.setProperty("--image-parallax", `${offset.toFixed(1)}px`);
    });
  }

  function requestCentreParallax() {
    if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(updateCentreParallax);
  }

  requestCentreParallax();
  window.addEventListener("scroll", requestCentreParallax, { passive: true });
  window.addEventListener("resize", requestCentreParallax, { passive: true });
}

if (window.matchMedia("(hover: hover) and (pointer: fine)").matches
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".program-card, .branch-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
      const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.setProperty("--tilt-x", `${(horizontal * 3).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(-vertical * 3).toFixed(2)}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    });
  });
}

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    document.querySelectorAll('.nav-menu a[aria-current="location"]').forEach((link) => link.removeAttribute("aria-current"));
    const activeLink = document.querySelector(`.nav-menu a[href="#${entry.target.id}"]`);
    if (activeLink) activeLink.setAttribute("aria-current", "location");
  });
}, { rootMargin: "-30% 0px -60% 0px" });
document.querySelectorAll("main section[id]").forEach((section) => sectionObserver.observe(section));

document.querySelectorAll("[data-interest]").forEach((link) => {
  link.addEventListener("click", () => {
    const requestedInterest = link.dataset.interest;
    const programOption = Array.from(programSelect.options).find((option) => option.text === requestedInterest);
    if (programOption) programSelect.value = programOption.value;
    if (requestedInterest === "Rayapuram branch") {
      document.querySelector("#branch-select").value = "Rayapuram (coming soon)";
    }
  });
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());

const form = document.querySelector("#enquiry-form");
const reviewDialog = document.querySelector("#review-dialog");
const whatsappPreview = document.querySelector("#whatsapp-preview");
const openWhatsapp = document.querySelector("#open-whatsapp");
const errorSummary = document.querySelector("#form-error-summary");
const phonePattern = /^[+()\d\s.-]{7,20}$/;

const fieldChecks = [
  { name: "name", input: document.querySelector("#parent-name"), error: document.querySelector("#name-error"), validate: (value) => value.trim().length > 0, message: "Please enter your name." },
  { name: "phone", input: document.querySelector("#parent-phone"), error: document.querySelector("#phone-error"), validate: (value) => phonePattern.test(value.trim()) && value.replace(/\D/g, "").length >= 7, message: "Enter a valid phone number." },
  { name: "branch", input: document.querySelector("#branch-select"), error: document.querySelector("#branch-error"), validate: (value) => value.length > 0, message: "Please choose a preferred branch." },
  { name: "message", input: document.querySelector("#message"), error: document.querySelector("#message-error"), validate: (value) => value.trim().length > 0, message: "Please add a short message." },
];

fieldChecks.forEach(({ input, error, validate, message }) => {
  input.addEventListener("input", () => {
    if (!input.getAttribute("aria-invalid")) return;
    const isValid = validate(input.value);
    input.setAttribute("aria-invalid", String(!isValid));
    error.textContent = isValid ? "" : message;
  });
  input.addEventListener("change", () => {
    if (!input.getAttribute("aria-invalid")) return;
    const isValid = validate(input.value);
    input.setAttribute("aria-invalid", String(!isValid));
    error.textContent = isValid ? "" : message;
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  let firstInvalidField = null;
  fieldChecks.forEach(({ input, error, validate, message }) => {
    const isValid = validate(input.value);
    input.setAttribute("aria-invalid", String(!isValid));
    error.textContent = isValid ? "" : message;
    if (!isValid && !firstInvalidField) firstInvalidField = input;
  });

  if (firstInvalidField) {
    errorSummary.hidden = false;
    firstInvalidField.focus();
    return;
  }

  errorSummary.hidden = true;
  const formData = new FormData(form);
  const message = [
    `Hello ${liveSiteContent && liveSiteContent.company ? liveSiteContent.company.fullName : "Jack & Jane Developmental Centre"},`,
    "",
    `My name is ${formData.get("name")}.`,
    `Phone: ${formData.get("phone")}`,
    `Preferred branch: ${formData.get("branch")}`,
    `Program of interest: ${formData.get("program") || "Not specified"}`,
    "",
    `Message: ${String(formData.get("message")).trim()}`,
  ].join("\n");
  whatsappPreview.textContent = message;
  const whatsappNumber = liveSiteContent && liveSiteContent.contact
    ? liveSiteContent.contact.whatsappNumber
    : "917397271374";
  openWhatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  reviewDialog.showModal();
  document.querySelector("#edit-message").focus();
});

document.querySelector("#edit-message").addEventListener("click", () => reviewDialog.close());
reviewDialog.addEventListener("click", (event) => {
  if (event.target === reviewDialog) reviewDialog.close();
});

let liveSiteContent = null;
let liveBranches = [];
let liveGallery = [];

function createIcon(symbol) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${symbol}`);
  svg.append(use);
  return svg;
}

function assetUrl(path) {
  if (typeof path !== "string" || !/^(imagees|assets\/gallery)\//.test(path)) return "";
  return path.split("/").map(encodeURIComponent).join("/");
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function setRichHeading(element, firstLine, emphasis, splitLine) {
  if (!element) return;
  element.classList.remove("split-heading", "is-split-visible");
  element.removeAttribute("aria-label");
  element.replaceChildren(document.createTextNode(firstLine));
  if (splitLine) element.append(document.createElement("br"));
  else element.append(document.createTextNode(" "));
  const em = document.createElement("em");
  em.textContent = emphasis;
  element.append(em);
}

function renderServices(services) {
  programGrid.replaceChildren();
  programSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a program";
  programSelect.append(placeholder);

  services.forEach((service, index) => {
    const card = document.createElement("article");
    card.className = "program-card reveal is-visible";
    const head = document.createElement("div");
    head.className = "program-head";
    const symbol = document.createElement("span");
    symbol.className = "program-symbol";
    symbol.append(createIcon(service.symbol));
    const number = document.createElement("span");
    number.className = "program-number";
    number.textContent = `${String(index + 1).padStart(2, "0")} / ${String(services.length).padStart(2, "0")}`;
    head.append(symbol, number);
    const title = document.createElement("h3");
    title.textContent = service.title;
    const description = document.createElement("p");
    description.textContent = service.description;
    const link = document.createElement("a");
    link.className = "text-link text-link--green";
    link.href = "#contact";
    link.dataset.interest = service.title;
    link.append(document.createTextNode("Make an enquiry "), createIcon("arrow-up-right"));
    card.append(head, title, description, link);
    programGrid.append(card);

    const option = document.createElement("option");
    option.value = service.title;
    option.textContent = service.title;
    programSelect.append(option);
  });
}

function addBranchDetail(container, label, value, href) {
  if (!value) return;
  const detail = document.createElement("div");
  detail.className = "branch-detail";
  const name = document.createElement("span");
  name.className = "detail-label";
  name.textContent = label;
  const valueElement = href ? document.createElement("a") : document.createElement("p");
  valueElement.textContent = value;
  if (href) {
    valueElement.href = href;
    if (href.startsWith("https:")) {
      valueElement.target = "_blank";
      valueElement.rel = "noopener noreferrer";
    }
  }
  detail.append(name, valueElement);
  container.append(detail);
}

function renderBranch(branch, index, total) {
  const card = document.createElement("article");
  card.className = `branch-card reveal is-visible${branch.featured ? " branch-card--featured" : ""}${branch.comingSoon ? " branch-card--soon" : ""}`;
  const imageArea = document.createElement("div");
  imageArea.className = "branch-image";
  const galleryItem = liveGallery.find((image) => image.id === branch.imageGalleryId)
    || liveGallery.find((image) => image.src === branch.image);
  const imagePath = galleryItem ? galleryItem.src : branch.image;
  if (imagePath) {
    const image = document.createElement("img");
    image.src = assetUrl(imagePath);
    image.alt = `${branch.name} branch at Jack & Jane Developmental Centre`;
    if (galleryItem) image.dataset.galleryId = galleryItem.id;
    else if (branch.imageGalleryId) image.dataset.galleryId = branch.imageGalleryId;
    image.loading = "lazy";
    image.decoding = "async";
    imageArea.append(image);
  } else {
    imageArea.classList.add("branch-image--illustrated");
    ["rayapuram-sun", "rayapuram-cloud rayapuram-cloud--one", "rayapuram-cloud rayapuram-cloud--two", "rayapuram-house"].forEach((classes) => {
      const decoration = document.createElement("span");
      decoration.className = classes;
      imageArea.append(decoration);
    });
  }
  const status = document.createElement("span");
  status.className = `status${branch.comingSoon ? " status--soon" : ""}`;
  const statusDot = document.createElement("i");
  status.append(statusDot, document.createTextNode(branch.status));
  const number = document.createElement("span");
  number.className = "branch-number";
  number.textContent = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  imageArea.append(status, number);

  const content = document.createElement("div");
  content.className = "branch-content";
  const area = document.createElement("p");
  area.className = "branch-area";
  area.append(document.createTextNode(branch.name));
  if (!branch.comingSoon) {
    const city = document.createElement("span");
    city.textContent = ` · ${liveSiteContent.company.location.split(",")[0]}`;
    area.append(city);
  }
  const title = document.createElement("h3");
  title.textContent = branch.title;
  content.append(area, title);

  if (branch.comingSoon) {
    const description = document.createElement("p");
    description.className = "soon-copy";
    description.textContent = branch.description || "";
    content.append(description);
  } else {
    const details = document.createElement("div");
    details.className = "branch-details";
    addBranchDetail(details, "Address", branch.address);
    addBranchDetail(details, "Landmark", branch.landmark);
    addBranchDetail(details, "Phone", branch.phone, `tel:${branch.phone.replace(/[^\d+]/g, "")}`);
    addBranchDetail(details, "Email", branch.email, `mailto:${branch.email}`);
    addBranchDetail(details, "Opening hours", branch.hours);
    content.append(details);
    if (branch.featured && branch.rating) {
      const rating = document.createElement("p");
      rating.className = "rating-note";
      rating.append(createIcon("star"), document.createTextNode(` ${branch.rating} `));
      const reviews = document.createElement("span");
      reviews.className = "rating-reviews";
      reviews.textContent = `· ${branch.reviews || ""}`;
      rating.append(reviews);
      content.append(rating);
    }
  }

  const actions = document.createElement("div");
  actions.className = "branch-actions";
  if (branch.comingSoon) {
    const enquire = document.createElement("a");
    enquire.className = "button button--primary";
    enquire.href = "#contact";
    enquire.dataset.interest = `${branch.name} branch`;
    enquire.textContent = `Enquire about ${branch.name}`;
    actions.append(enquire);
  } else {
    const call = document.createElement("a");
    call.className = "button button--primary";
    call.href = `tel:${branch.phone.replace(/[^\d+]/g, "")}`;
    call.textContent = "Call";
    actions.append(call);
    const mapsUrl = safeHttpsUrl(branch.mapsUrl);
    if (mapsUrl) {
      const maps = document.createElement("a");
      maps.className = "button button--outline";
      maps.href = mapsUrl;
      maps.target = "_blank";
      maps.rel = "noopener noreferrer";
      maps.append(document.createTextNode("Google Maps directions "), createIcon("arrow-up-right"));
      actions.append(maps);
    }
  }
  content.append(actions);
  card.append(imageArea, content);
  return card;
}

function renderBranches(branches) {
  const grid = document.querySelector("#branch-grid");
  const visible = branches.filter((branch) => branch.visible).sort((a, b) => a.order - b.order);
  grid.replaceChildren(...visible.map((branch, index) => renderBranch(branch, index, visible.length)));
  const operatingCount = visible.filter((branch) => !branch.comingSoon).length;
  document.querySelector("#branch-schedule-note").textContent = operatingCount === 2
    ? "Both branches are closed on Sundays and the third Saturday of each month."
    : "Opening hours vary by centre. Please contact the branch to confirm availability.";

  const selector = document.querySelector("#branch-select");
  selector.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a branch";
  selector.append(placeholder);
  visible.forEach((branch) => {
    const option = document.createElement("option");
    option.value = branch.name;
    option.textContent = branch.comingSoon ? `${branch.name} (coming soon)` : branch.name;
    selector.append(option);
  });
  const unsure = document.createElement("option");
  unsure.value = "Not sure yet";
  unsure.textContent = "Not sure yet";
  selector.append(unsure);

  const locations = document.querySelector("#contact-locations");
  locations.replaceChildren();
  visible.forEach((branch) => {
    const line = document.createElement("p");
    const name = document.createElement("strong");
    name.textContent = branch.name;
    line.append(name, document.createTextNode(` · ${branch.comingSoon ? branch.status : branch.address}`));
    locations.append(line);
  });

  const footerBranches = document.querySelector("#footer-branches");
  const heading = document.createElement("h2");
  heading.textContent = "Find us";
  footerBranches.replaceChildren(heading);
  visible.forEach((branch) => {
    const line = document.createElement("p");
    const name = document.createElement("strong");
    name.textContent = branch.name;
    line.append(name, document.createElement("br"), document.createTextNode(branch.comingSoon ? branch.status : branch.address));
    footerBranches.append(line);
  });
}

function renderGallery(gallery) {
  const container = document.querySelector("#public-gallery");
  const visible = gallery.filter((image) => image.visible).sort((a, b) => a.order - b.order);
  container.replaceChildren(...visible.map((image) => {
    const figure = document.createElement("figure");
    figure.className = "photo-gallery-card";
    const photo = document.createElement("img");
    const previewUrl = previewContent && previewContent.previewAssets
      ? previewContent.previewAssets[image.id]
      : "";
    photo.src = typeof previewUrl === "string" && previewUrl.startsWith(`blob:${window.location.origin}/`)
      ? previewUrl
      : assetUrl(image.src);
    photo.alt = image.description;
    photo.loading = "lazy";
    photo.decoding = "async";
    const caption = document.createElement("figcaption");
    caption.textContent = image.title;
    figure.append(photo, caption);
    return figure;
  }));
}

function syncGalleryImages(gallery) {
  const byId = new Map(gallery.map((image) => [image.id, image]));
  document.querySelectorAll("img[data-gallery-id]").forEach((image) => {
    const item = byId.get(image.dataset.galleryId);
    const previewUrl = previewContent && previewContent.previewAssets
      ? previewContent.previewAssets[image.dataset.galleryId]
      : "";
    image.classList.toggle("is-gallery-hidden", !item || !item.visible);
    if (!item) return;
    image.src = typeof previewUrl === "string" && previewUrl.startsWith(`blob:${window.location.origin}/`)
      ? previewUrl
      : assetUrl(item.src);
    image.alt = item.description;
  });
}

function updateContactLinks(content) {
  const phone = content.contact.phone;
  const email = content.contact.email;
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, "")}`;
  const whatsappText = `Hello ${content.company.fullName}, I would like to know more about your programs and available branches.`;
  const whatsappHref = `https://wa.me/${content.contact.whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => { link.href = phoneHref; });
  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => { link.href = `mailto:${email}`; });
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => { link.href = whatsappHref; });
  document.querySelectorAll(".contact-quick-link[href^='tel:'] strong").forEach((node) => { node.textContent = phone; });
  document.querySelectorAll(".contact-quick-link[href^='mailto:'] strong").forEach((node) => { node.textContent = email; });
  document.querySelectorAll(".contact-quick-link[href^='tel:'] small").forEach((node) => { node.textContent = "Call us"; });

  const mapUrl = safeHttpsUrl(content.contact.mapUrl);
  const embedUrl = safeHttpsUrl(content.contact.mapEmbedUrl);
  const mapCard = document.querySelector(".map-card");
  const mapFrame = mapCard.querySelector("iframe");
  if (mapUrl) mapCard.href = mapUrl;
  if (embedUrl) mapFrame.src = embedUrl;
}

function applyPublicData(content, branches, gallery) {
  if (!content || !Array.isArray(content.services) || !Array.isArray(branches) || !Array.isArray(gallery)) {
    throw new Error("The published website content has an invalid format.");
  }
  liveSiteContent = content;
  liveBranches = branches;
  liveGallery = gallery;
  const hero = content.hero;
  setRichHeading(document.querySelector(".hero h1"), hero.heading, hero.emphasis, true);
  document.querySelector(".hero-lede").textContent = hero.description;
  document.querySelector(".hero-signoff span:last-child").textContent = hero.tagline;

  const about = content.about;
  const aboutCopy = document.querySelector(".about-copy");
  aboutCopy.querySelector(".eyebrow").textContent = about.eyebrow;
  setRichHeading(aboutCopy.querySelector("h2"), about.heading, about.emphasis, false);
  Array.from(aboutCopy.children).filter((node) => node.tagName === "P" && !node.classList.contains("eyebrow"))
    .forEach((paragraph, index) => { paragraph.textContent = about.paragraphs[index] || ""; paragraph.hidden = !about.paragraphs[index]; });
  const chips = aboutCopy.querySelector(".value-chips");
  chips.replaceChildren(...about.values.map((value) => {
    const chip = document.createElement("span");
    chip.textContent = value;
    return chip;
  }));

  document.querySelectorAll(".brand-copy strong").forEach((node) => { node.textContent = content.company.name; });
  document.querySelectorAll(".hero-bottom span:last-child").forEach((node) => { node.textContent = content.company.location; });
  const centreLocation = document.querySelector(".centres-location");
  if (centreLocation.lastChild.nodeType === Node.TEXT_NODE) centreLocation.lastChild.textContent = ` ${content.company.location}`;
  document.querySelector("#contact .contact-copy > p:not(.eyebrow)").textContent = content.contact.intro;
  document.querySelector(".footer-brand > p").textContent = content.footer.tagline;
  const belief = document.querySelector(".footer-belief");
  belief.replaceChildren(document.createTextNode(content.footer.beliefLines[0] || ""), document.createElement("br"), document.createTextNode(content.footer.beliefLines[1] || ""));
  document.querySelector(".footer-bottom > span:last-child").textContent = content.footer.closing;
  document.title = `${content.company.fullName} | Child Development Support in Chennai`;
  document.querySelector('meta[property="og:title"]').content = document.title;
  updateContactLinks(content);
  renderServices(content.services);
  renderBranches(branches);
  syncGalleryImages(gallery);
  renderGallery(gallery);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-interest]");
  if (!link || !liveSiteContent) return;
  const interest = link.dataset.interest;
  const service = liveSiteContent.services.find((item) => item.title === interest);
  if (service) {
    programSelect.value = service.title;
    return;
  }
  const branchName = interest.replace(/\s+branch$/i, "");
  const branch = liveBranches.find((item) => item.name === branchName);
  if (branch) document.querySelector("#branch-select").value = branch.name;
});

let previewContent = null;
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || !event.data || event.data.type !== "jack-jane-admin-preview") return;
  try {
    previewContent = event.data;
    applyPublicData(event.data.content, event.data.branches, event.data.gallery);
    document.documentElement.dataset.adminPreview = "true";
  } catch (error) {
    console.error("Could not display the admin preview.", error);
  }
});

Promise.all([
  fetch("data/content.json").then((response) => {
    if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
    return response.json();
  }),
  fetch("data/branches.json").then((response) => {
    if (!response.ok) throw new Error(`Branch request failed (${response.status}).`);
    return response.json();
  }),
  fetch("data/gallery.json").then((response) => {
    if (!response.ok) throw new Error(`Gallery request failed (${response.status}).`);
    return response.json();
  }),
]).then(([content, branches, gallery]) => {
  const selected = previewContent || { content, branches, gallery };
  applyPublicData(selected.content, selected.branches, selected.gallery);
}).catch((error) => {
  console.error("Could not load the published website content; keeping the built-in page content.", error);
});

if (window.parent !== window) {
  window.parent.postMessage({ type: "jack-jane-preview-ready" }, window.location.origin);
}
