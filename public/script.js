/* ---------------------------------------------------------
   AI Prompt Enhancement Tool — front-end interaction layer
   ---------------------------------------------------------
   The two functions marked TODO are where this file currently
   fakes the AI calls just so the layout/flow can be demoed.
   Once the backend (api/enhance.js etc.) exists, swap the
   mock bodies for real `fetch()` calls to your serverless
   endpoints — the rest of the flow doesn't need to change.
----------------------------------------------------------- */

const promptInput = document.getElementById("promptInput");
const analyzingState = document.getElementById("analyzingState");
const questionsSection = document.getElementById("questionsSection");
const resultSection = document.getElementById("resultSection");
const resultBox = document.getElementById("resultBox");
const copyBtn = document.getElementById("copyBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsClose = document.getElementById("settingsClose");

let originalPrompt = "";

/* ---------- Settings panel ---------- */

settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("open");
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsBtn.setAttribute("aria-expanded", "true");
});

settingsClose.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (e) => {
  if (e.target === settingsPanel) closeSettings();
});

function closeSettings() {
  settingsPanel.classList.remove("open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsBtn.setAttribute("aria-expanded", "false");
}

/* ---------- Step 1: user submits their rough prompt ---------- */

promptInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const value = promptInput.value.trim();
  if (!value) return;

  originalPrompt = value;
  promptInput.disabled = true;

  analyzingState.classList.add("visible");
  analyzingState.textContent = "Analyzing your prompt…";

  const questions = await fetchClarifyingQuestions(originalPrompt);

  analyzingState.classList.remove("visible");
  renderQuestions(questions);
});

async function fetchClarifyingQuestions(prompt) {
  try {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`Request failed: ${res.status}`);

    const data = await res.json();
    return data.questions;
  } catch (err) {
    console.error("Failed to fetch clarifying questions:", err);
    return ["Something went wrong generating questions — try again?"];
  }
}

/* ---------- Step 2: render questions + answer inputs ---------- */

function renderQuestions(questions) {
  questionsSection.innerHTML = "";

  questions.forEach((question, index) => {
    const block = document.createElement("div");
    block.className = "question-block";

    const label = document.createElement("p");
    label.className = "question-text";
    label.textContent = question;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "answer-input";
    input.placeholder = "Type your answer…";
    input.dataset.questionIndex = index;

    block.appendChild(label);
    block.appendChild(input);
    questionsSection.appendChild(block);
  });

  const enhanceBtn = document.createElement("button");
  enhanceBtn.className = "enhance-btn";
  enhanceBtn.textContent = "Enhance my prompt";
  enhanceBtn.addEventListener("click", handleEnhanceClick);
  questionsSection.appendChild(enhanceBtn);

  // Single fade-in reveal, not staggered per question.
  requestAnimationFrame(() => questionsSection.classList.add("visible"));
}

/* ---------- Step 3: send prompt + answers, show result ---------- */

async function handleEnhanceClick() {
  const questionBlocks = questionsSection.querySelectorAll(".question-block");
  const qa = Array.from(questionBlocks).map((block) => ({
    question: block.querySelector(".question-text").textContent,
    answer: block.querySelector(".answer-input").value.trim(),
  }));

  resultBox.textContent = "Enhancing…";
  resultSection.classList.add("visible");

  const enhancedPrompt = await fetchEnhancedPrompt(originalPrompt, qa);
  resultBox.textContent = enhancedPrompt;
}

async function fetchEnhancedPrompt(prompt, qa) {
  try {
    const res = await fetch("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, qa }),
    });

    if (!res.ok) throw new Error(`Request failed: ${res.status}`);

    const data = await res.json();
    return data.enhancedPrompt;
  } catch (err) {
    console.error("Failed to fetch enhanced prompt:", err);
    return "Something went wrong enhancing your prompt — try again?";
  }
}

/* ---------- Copy result to clipboard ---------- */

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultBox.textContent);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = original), 1500);
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
});