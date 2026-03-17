#!/usr/bin/env node

import { getTags, getCategories } from '../lib/wp-client.js';

async function main() {
  try {
    const [tags, categories] = await Promise.all([
      getTags({ per_page: 100 }),
      getCategories({ per_page: 100 }),
    ]);

    console.log(
      JSON.stringify(
        {
          tags,
          categories,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error('[wp-get-tags] 讀取失敗');
    if (error.response) {
      console.error('status:', error.response.status);
      console.error('data:', error.response.data);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

main();

