/**
 * Print a fresh VAPID keypair for web push.
 *
 * Run with: npm run generate-vapid-keys
 *
 * The keys are an identity for this deployment, not a secret shared with
 * anyone. Replacing them invalidates every existing push subscription, so
 * generate once and keep them with the rest of your environment config.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\nAdd these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('\nChange VAPID_SUBJECT to a contact address for your instance.');
console.log('Replacing these keys later will unsubscribe every device.\n');
