---
title: "JavaScript SDK"
subtitle: "AI translation with JavaScript and Lingo.dev"
---

## Introduction

The **Lingo.dev JavaScript SDK** adds real-time AI-powered translation to web applications, Node.js servers, and frontend frameworks. The SDK handles dynamic content like chat messages, user comments, and live data that needs instant translation.

Unlike static file localization with **Lingo.dev CLI**, the SDK processes content on-demand, making it ideal for chat applications, email clients, and social media tools where content changes constantly.

## Installation

```bash
npm install lingo.dev
```

## Basic setup

The SDK requires an API key from Lingo.dev.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});
```

## Text translation

Translate simple text strings to a target language.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const result = await lingoDotDev.localizeText("Hello, world!", {
  sourceLocale: "en",
  targetLocale: "es",
});
console.log(result);
// Output: "¡Hola Mundo!"
```

## Object translation

Translate nested objects while preserving structure. The SDK recursively processes all string values.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const content = {
  greeting: "Hello",
  farewell: "Goodbye",
  message: "Welcome to our platform",
};

const translated = await lingoDotDev.localizeObject(content, {
  sourceLocale: "en",
  targetLocale: "es",
});
console.log(translated);
// Output: { greeting: "Hola", farewell: "Adiós", message: "Bienvenido a nuestra plataforma" }
```

## Batch translation to multiple languages

Translate content to multiple target languages in a single call. Returns an array with one result per target locale.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const results = await lingoDotDev.batchLocalizeText("Hello, world!", {
  sourceLocale: "en",
  targetLocales: ["es", "fr", "de"],
});
console.log(results);
// Output: ['¡Hola Mundo!', 'Bonjour le monde!', 'Hallo Welt!']
```

## Chat translation

Translate chat messages while preserving speaker names. Each message must have both "name" and "text" fields.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const conversation = [
  { name: "Alice", text: "Hello!" },
  { name: "Bob", text: "How are you?" },
  { name: "Alice", text: "I'm doing well, thanks!" },
];

const translated = await lingoDotDev.localizeChat(conversation, {
  sourceLocale: "en",
  targetLocale: "es",
});

for (const message of translated) {
  console.log(`${message.name}: ${message.text}`);
}
// Output:
// Alice: ¡Hola!
// Bob: ¿Cómo estás?
// Alice: ¡Me va bien, gracias!
```

## HTML translation

Translate HTML while preserving markup. Maintains all tags, attributes, and structure while translating only text content.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const html = "<div>Hello <strong>world</strong></div>";

const translated = await lingoDotDev.localizeHtml(html, {
  sourceLocale: "en",
  targetLocale: "es",
});
console.log(translated);
// Output: "<div>Hola <strong>mundo</strong></div>"
```

## Progress tracking

Monitor translation progress with a callback. Useful for updating UI during large translation operations.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const largeObject = {
  page1: "Welcome to our application",
  page2: "This is the second page",
  page3: "Here is more content",
  page4: "Final page of content",
};

await lingoDotDev.localizeObject(
  largeObject,
  { sourceLocale: "en", targetLocale: "es" },
  (progress) => {
    console.log(`Translation progress: ${progress}%`);
  },
);
// Output:
// Translation progress: 25%
// Translation progress: 50%
// Translation progress: 75%
// Translation progress: 100%
```

## Translation parameters

Speed vs quality control for time-sensitive applications.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const result = await lingoDotDev.localizeText("Hello world", {
  sourceLocale: "en",
  targetLocale: "es",
  fast: true, // Prioritize speed over quality
});
console.log(result);
// Output: "Hola mundo"
```

## Configuration

Control batching behavior. The SDK splits large payloads based on item count and word count constraints.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
  batchSize: 100, // Max items per API request (default: 50, max: 250)
  idealBatchItemSize: 1000, // Target word count per batch (default: 500, max: 2500)
});

const result = await lingoDotDev.localizeText("Configuration test", {
  sourceLocale: "en",
  targetLocale: "es",
});
console.log(result);
// Output: "Prueba de configuración"
```

## Language detection

Detect the language of a text string. Use only when the source language is unknown, as detection adds processing time.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const locale = await lingoDotDev.recognizeLocale("Bonjour le monde");
console.log(locale);
// Output: 'fr'
```

Use with automatic detection:

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

const result = await lingoDotDev.localizeText("Bonjour le monde", {
  sourceLocale: null, // Auto-detect
  targetLocale: "en",
});
console.log(result);
// Output: "Hello world"
```

## Error handling

The SDK includes automatic retries for network issues. Implement application-level error handling for other failures.

```javascript
import { LingoDotDevEngine } from "lingo.dev/sdk";

const lingoDotDev = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY,
});

try {
  const result = await lingoDotDev.localizeText("Hello", {
    sourceLocale: "en",
    targetLocale: "es",
  });
  console.log(result);
} catch (error) {
  console.error("Translation failed:", error.message);
  // Handle error appropriately
}
```