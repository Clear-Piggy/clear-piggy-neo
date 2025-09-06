// Quick script to toggle duplicate checking in ReceiptUpload component

const fs = require('fs');
const path = './src/components/ReceiptUpload.tsx';

function toggleDuplicateCheck(enable = true) {
  const content = fs.readFileSync(path, 'utf8');
  
  if (enable) {
    // Enable duplicate checking (default behavior)
    const updated = content.replace(
      /\/\/ DUPLICATE_CHECK_DISABLED[\s\S]*?\/\/ Check for duplicate/,
      '      // Check for duplicate'
    );
    fs.writeFileSync(path, updated);
    console.log('✅ Duplicate checking ENABLED');
    console.log('The same file cannot be uploaded twice.');
  } else {
    // Disable duplicate checking (for testing)
    const updated = content.replace(
      '      // Check for duplicate',
      '      // DUPLICATE_CHECK_DISABLED\n      /*\n      // Check for duplicate'
    ).replace(
      '      if (existingDoc) {\n        throw new Error(`Duplicate receipt: ${(existingDoc as any)?.filename || \'file\'} already uploaded`);\n      }',
      '      if (existingDoc) {\n        throw new Error(`Duplicate receipt: ${(existingDoc as any)?.filename || \'file\'} already uploaded`);\n      }\n      */'
    );
    fs.writeFileSync(path, updated);
    console.log('⚠️  Duplicate checking DISABLED');
    console.log('WARNING: The same file can now be uploaded multiple times!');
    console.log('This should only be used for testing.');
  }
}

// Check command line argument
const action = process.argv[2];

if (action === 'disable') {
  toggleDuplicateCheck(false);
} else if (action === 'enable') {
  toggleDuplicateCheck(true);
} else {
  console.log('Usage:');
  console.log('  node toggle-duplicate-check.js disable  - Allow duplicate uploads');
  console.log('  node toggle-duplicate-check.js enable   - Prevent duplicate uploads (default)');
  console.log('');
  console.log('Current status: Duplicate checking is ENABLED');
}