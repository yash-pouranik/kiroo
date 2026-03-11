import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { getAllInteractions } from './storage.js';

export function exportToPostman(outFileName) {
  try {
    const interactions = getAllInteractions();

    if (interactions.length === 0) {
      console.log(chalk.yellow('\n  ⚠️ No interactions found to export.'));
      console.log(chalk.gray('  Run some requests first before exporting.\n'));
      return;
    }

    const postmanCollection = {
      info: {
        name: `Kiroo Export - ${new Date().toISOString().split('T')[0]}`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: interactions.map(int => {
        // Map Headers
        const headerList = Object.entries(int.request.headers || {}).map(([key, value]) => ({
          key,
          value: value.toString(),
          type: "text"
        }));

        // Format body
        let rawBody = '';
        if (int.request.body) {
          rawBody = typeof int.request.body === 'object' 
            ? JSON.stringify(int.request.body, null, 2) 
            : int.request.body.toString();
        }

        // Response Body
        let resBodyStr = '';
        if (int.response.body) {
            resBodyStr = typeof int.response.body === 'object'
            ? JSON.stringify(int.response.body, null, 2)
            : int.response.body.toString();
        }

        return {
          name: `[${int.request.method}] ${int.request.url}`,
          request: {
            method: int.request.method.toUpperCase(),
            header: headerList,
            url: {
              raw: int.request.url
            },
            ...(rawBody ? {
              body: {
                mode: "raw",
                raw: rawBody,
                options: {
                  raw: { language: "json" }
                }
              }
            } : {})
          },
          response: [
            {
              name: "Saved Example from Kiroo",
              originalRequest: {
                method: int.request.method.toUpperCase(),
                header: headerList,
                url: { raw: int.request.url }
              },
              status: "Saved Response",
              code: int.response.status,
              _postman_previewlanguage: "json",
              header: [],
              cookie: [],
              body: resBodyStr
            }
          ]
        };
      })
    };

    const outputPath = join(process.cwd(), outFileName);
    writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));

    console.log(chalk.green(`\n  ✅ Collection exported successfully!`));
    console.log(chalk.gray(`  Saved to: ${outputPath}`));
    console.log(chalk.magenta(`  You can now import this file directly into Postman/Insomnia.\n`));

  } catch (error) {
    console.error(chalk.red('\n  ✗ Export failed:'), error.message, '\n');
  }
}
