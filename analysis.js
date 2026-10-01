/**
 * Local content analysis for missed SAT questions.
 *
 * This uses the official rationale, question text, answer choices, and the
 * learner's wrong-choice history. It does not send study data to a service.
 */
(function exposeAnalyzer(globalScope) {
  "use strict";

  const RULES = [
    {
      id: "subject-verb-agreement",
      label: "Subject–verb agreement",
      category: "Grammar: agreement",
      patterns: [/subject[-– ]verb agreement/i, /verb[-– ]noun agreement/i, /(?:noun|subject) and (?:the )?verb.{0,35}agree/i, /verb .{0,45}agree(?:s|ment)? in number/i, /singular (?:subject|noun).{0,70}plural verb/i, /plural (?:subject|noun).{0,70}singular verb/i],
      concepts: [
        "Find the complete subject and decide whether its head noun is singular or plural.",
        "Ignore interrupting phrases between the subject and verb; they do not change the subject's number.",
        "Match a singular subject with a singular verb and a plural subject with a plural verb, including compound tenses.",
      ],
      practice: "Underline the subject's head noun, cross out interrupting phrases, and then test the verb by number.",
    },
    {
      id: "plural-possessives",
      label: "Plural possessives",
      category: "Grammar: possessives",
      patterns: [/plural possessive/i, /plural noun.{0,55}apostrophe/i, /apostrophe (?:after|following) (?:the )?(?:final )?s/i, /possessive form of (?:a )?plural/i],
      concepts: [
        "First decide whether the noun means one owner or multiple owners.",
        "For a regular plural already ending in s, place the apostrophe after the s: students'.",
        "For an irregular plural not ending in s, add apostrophe-s: children's.",
      ],
      practice: "Rewrite the phrase with ‘of’ to identify the owners, then rebuild it with the correct possessive form.",
    },
    {
      id: "singular-possessives",
      label: "Singular possessives",
      category: "Grammar: possessives",
      patterns: [/singular possessive/i, /singular noun.{0,55}apostrophe/i, /apostrophe[- ]s.{0,45}singular/i, /possessive form of (?:a )?singular/i],
      concepts: [
        "Use apostrophe-s for a singular noun that owns or is closely associated with something.",
        "Do not use an apostrophe merely to make a noun plural.",
        "Confirm that the sentence expresses possession rather than a contraction or ordinary plural.",
      ],
      practice: "Identify the single owner and the thing owned, then test whether noun + 's preserves that relationship.",
    },
    {
      id: "pronoun-antecedent-agreement",
      label: "Pronoun–antecedent agreement",
      category: "Grammar: agreement",
      patterns: [/pronoun[-– ]antecedent agreement/i, /pronoun.{0,55}agree.{0,30}(?:antecedent|noun)/i, /antecedent.{0,55}(?:singular|plural) pronoun/i],
      concepts: [
        "Identify the exact noun that the pronoun replaces.",
        "Match the pronoun to its antecedent in number and person.",
        "Remove ambiguity: a pronoun must point clearly to one logical antecedent.",
      ],
      practice: "Replace the pronoun with its antecedent; if the sentence's meaning or number breaks, revise the pronoun.",
    },
    {
      id: "verb-tense-and-aspect",
      label: "Verb tense and aspect",
      category: "Grammar: verbs",
      patterns: [/verb tense/i, /tense consistency/i, /past perfect|present perfect|future perfect/i, /sequence of (?:events|tenses)/i],
      concepts: [
        "Use time markers and surrounding verbs to establish when each action occurs.",
        "Keep tense consistent unless the timeline genuinely changes.",
        "Use perfect tenses to show that one event was completed before another reference time.",
      ],
      practice: "Draw a short timeline for the events, then choose the tense that places each action correctly.",
    },
    {
      id: "modifier-placement",
      label: "Modifier placement",
      category: "Grammar: sentence structure",
      patterns: [/dangling modifier|misplaced modifier|modifier placement/i, /modifier.{0,60}(?:modify|describe|refer)/i, /introductory phrase.{0,55}(?:subject|noun)/i],
      concepts: [
        "Place a modifier next to the word or phrase it logically describes.",
        "After an introductory modifier, name the person or thing performing that action immediately.",
        "Check that moving or deleting the modifier does not create an unintended meaning.",
      ],
      practice: "Circle the modifier and draw an arrow to its target; revise if the connection is not immediate and logical.",
    },
    {
      id: "parallel-structure",
      label: "Parallel structure",
      category: "Grammar: sentence structure",
      patterns: [/parallel structure|parallelism|parallel construction/i, /items? in (?:a )?(?:list|series).{0,55}(?:same|consistent) grammatical form/i],
      concepts: [
        "Items joined in a list or comparison should use the same grammatical form.",
        "Match nouns with nouns, infinitives with infinitives, and clauses with clauses.",
        "Read only the coordinated elements to hear whether their structures align.",
      ],
      practice: "Bracket the coordinated items and label each form; rewrite any item whose form differs.",
    },
    {
      id: "independent-clause-boundaries",
      label: "Independent-clause boundaries",
      category: "Grammar: punctuation",
      patterns: [/independent clause/i, /comma splice|run-on sentence/i, /two complete sentences/i, /semicolon.{0,60}(?:clause|sentence)/i],
      concepts: [
        "An independent clause contains a subject and verb and expresses a complete thought.",
        "Join two independent clauses with a period, semicolon, or comma plus coordinating conjunction.",
        "A comma alone cannot join two independent clauses.",
      ],
      practice: "Test each side of the punctuation as a standalone sentence before choosing the boundary.",
    },
    {
      id: "fragments-and-dependent-clauses",
      label: "Sentence fragments and dependent clauses",
      category: "Grammar: sentence boundaries",
      patterns: [/sentence fragment|fragmented sentence/i, /dependent clause.{0,55}(?:cannot|not) stand alone/i, /subordinate clause/i],
      concepts: [
        "A dependent clause begins with a subordinating word and cannot stand alone.",
        "Attach a dependent clause to a nearby independent clause without creating a comma splice.",
        "Check that the completed sentence has a clear subject, finite verb, and complete thought.",
      ],
      practice: "Mark each clause independent or dependent, then connect every dependent clause to a complete clause.",
    },
    {
      id: "colons-and-dashes",
      label: "Colons and explanatory dashes",
      category: "Grammar: punctuation",
      patterns: [/colon.{0,60}(?:complete|independent) clause/i, /dash.{0,60}(?:explanation|elaboration|list)/i, /introduces? (?:a list|an explanation|an elaboration)/i],
      concepts: [
        "A colon must follow a complete clause and introduce an explanation, example, or list.",
        "A dash can introduce or set off emphatic information, but its structure must remain complete.",
        "Do not place a colon directly after a verb or preposition when the preceding words are incomplete.",
      ],
      practice: "Read only the words before the punctuation; use a colon or dash only if that part can stand alone.",
    },
    {
      id: "logical-transitions",
      label: "Logical transition relationships",
      category: "Expression of ideas",
      patterns: [/transition word|transition phrase|logical transition/i, /relationship between (?:the|these) (?:ideas|sentences)/i, /(?:contrast|cause and effect|illustration|continuation) transition/i],
      concepts: [
        "Determine whether the ideas continue, contrast, cause, exemplify, or sequence before viewing choices.",
        "Choose a transition for its logical function, not because it sounds polished.",
        "Read the sentence before and after the transition to verify the relationship in both directions.",
      ],
      practice: "State the relationship in one plain word—contrast, result, example, or continuation—then match it to a choice.",
    },
    {
      id: "inference-support",
      label: "Avoiding unsupported inferences",
      category: "Information and ideas",
      patterns: [/inference/i, /most logically completes/i, /supported by the text/i, /cannot be inferred/i],
      concepts: [
        "Choose the smallest conclusion that the stated evidence guarantees.",
        "Separate what is plausible from what is directly supported.",
        "Check every word in a choice; one unsupported claim makes the entire inference invalid.",
      ],
      practice: "Write ‘Because the text says ___, it follows that ___’ and fill both blanks with explicit evidence.",
    },
    {
      id: "words-in-context",
      label: "Words in context",
      category: "Craft and structure",
      patterns: [/words? in context/i, /most logical and precise word/i, /as used in the text/i, /connotation/i],
      concepts: [
        "Predict a simple word from the sentence's logic before considering the choices.",
        "Match both meaning and tone; a technically related word can still carry the wrong connotation.",
        "Use the ordinary contextual meaning rather than a rare dictionary definition.",
      ],
      practice: "Replace the target with your own plain-language prediction, then compare each choice to that prediction.",
    },
    {
      id: "rhetorical-synthesis",
      label: "Rhetorical synthesis and relevance",
      category: "Expression of ideas",
      patterns: [/rhetorical synthesis/i, /student wants to/i, /most effectively uses? (?:the )?notes/i, /writing goal/i],
      concepts: [
        "Use the stated writing goal to decide which notes are relevant.",
        "Exclude accurate information that does not directly serve the goal.",
        "Preserve the notes precisely without adding unsupported comparisons or conclusions.",
      ],
      practice: "Underline the goal's task verb and audience, then select only the facts that directly satisfy both.",
    },
  ];

  function clean(value = "") {
    return String(value).replace(/\s+/g, " ").trim();
  }

  function questionContent(question) {
    const wrongLetters = (question.mistakeHistory || []).map((attempt) => typeof attempt === "string" ? attempt : attempt.answer);
    const wrongAnswers = wrongLetters.map((letter) => question.answers?.[letter]).filter(Boolean);
    return clean([
      question.rationale,
      question.passage,
      question.prompt,
      ...Object.values(question.answers || {}),
      ...wrongAnswers,
    ].filter(Boolean).join(" "));
  }

  function wrongChoiceRationale(question) {
    const letters = [...new Set((question.mistakeHistory || []).map((attempt) => typeof attempt === "string" ? attempt : attempt.answer).filter(Boolean))];
    if (!letters.length) return "";
    const choiceChunks = (question.rationale || "").split(/(?=Choice\s+[A-D]\b)/i);
    return clean(choiceChunks.filter((chunk) => letters.some((letter) => new RegExp(`^Choice\\s+${letter}\\b`, "i").test(chunk.trim()))).join(" "));
  }

  function evidenceFor(content, patterns) {
    const sentences = content.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    return clean(sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || "");
  }

  function titleCase(value) {
    return clean(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function fallbackAnalysis(question, content) {
    const explicit = /(?:convention|skill|concept) being tested is\s+([^.;]+)/i.exec(question.rationale || "")?.[1];
    const imported = !/^(?:unspecified|mixed)?\s*$/i.test(question.skill || "") ? question.skill : "";
    const label = titleCase(explicit || imported || "Review the official rationale");
    return {
      id: `derived:${label.toLowerCase()}`,
      label,
      category: question.domain || "Content analysis",
      concepts: [
        `Relearn the exact rule identified as “${label}.”`,
        "Explain why the correct choice follows that rule and why each tempting choice violates it.",
        "Apply the rule to a fresh example without looking at the original answer choices.",
      ],
      practice: "Turn the official rationale into a one-sentence rule, then use that rule to solve two new examples.",
      evidence: clean(question.rationale || content).slice(0, 320),
      derived: true,
    };
  }

  function analyzeQuestion(question) {
    const selectedChoiceEvidence = wrongChoiceRationale(question);
    const content = questionContent(question);
    const namedConcept = /(?:convention|skill|concept) being tested is\s+([^.;]+)/i.exec(question.rationale || "")?.[0] || "";
    // When answer-specific rationale is available, diagnose from that evidence
    // plus the officially named concept. This avoids assigning a learner a
    // weakness mentioned only while explaining an option they never selected.
    const focusedContent = clean(`${selectedChoiceEvidence} ${namedConcept}`) || content;
    const matches = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(focusedContent)))
      .map((rule) => ({ ...rule, evidence: evidenceFor(selectedChoiceEvidence || question.rationale || content, rule.patterns), derived: false }));
    return matches.length ? matches : [fallbackAnalysis(question, content)];
  }

  function analyzeWeakSpots(questions) {
    const groups = new Map();
    questions.forEach((question) => {
      analyzeQuestion(question).forEach((analysis) => {
        if (!groups.has(analysis.id)) groups.set(analysis.id, { ...analysis, questions: [], domains: new Set(), difficulties: new Set() });
        const group = groups.get(analysis.id);
        if (!group.questions.some((item) => item.questionId === question.questionId)) group.questions.push(question);
        if (question.domain) group.domains.add(question.domain);
        if (question.difficulty) group.difficulties.add(question.difficulty);
        if (!group.evidence && analysis.evidence) group.evidence = analysis.evidence;
      });
    });

    return [...groups.values()].map((group) => ({
      ...group,
      repeated: group.questions.length >= 2,
      attempts: group.questions.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0),
    })).sort((a, b) => Number(b.repeated) - Number(a.repeated) || b.questions.length - a.questions.length || b.attempts - a.attempts);
  }

  const SATAnalyzer = { RULES, analyzeQuestion, analyzeWeakSpots };
  if (globalScope) globalScope.SATAnalyzer = SATAnalyzer;
  if (typeof module !== "undefined" && module.exports) module.exports = SATAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
