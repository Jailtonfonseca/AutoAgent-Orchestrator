import { credentialStore } from '../src/backend/credentials';
import { verifier } from '../src/backend/verifier';

async function runTests() {
  console.log("🚀 Starting Tests...");

  // 1. Test Credential Store
  console.log("\n--- Testing Credential Store ---");
  const userId = "test-user";
  const provider = "github";
  const secret = "ghp_test_token";

  console.log("Setting credential...");
  credentialStore.set(userId, provider, secret);
  
  const retrieved = credentialStore.get(userId, provider);
  if (retrieved === secret) {
    console.log("✅ Set/Get successful (encrypted/decrypted)");
  } else {
    console.log("❌ Set/Get failed");
  }

  console.log("Testing wait_for...");
  const waitPromise = credentialStore.waitFor(userId, "slack");
  setTimeout(() => credentialStore.set(userId, "slack", "xoxb-test"), 100);
  const waited = await waitPromise;
  if (waited === "xoxb-test") {
    console.log("✅ wait_for successful");
  } else {
    console.log("❌ wait_for failed");
  }

  // 2. Test Verifier
  console.log("\n--- Testing Verifier ---");
  const task = "Summarize AI news";
  const msg = "I found 3 articles about GPT-5. Here is the summary...";
  
  try {
    const result = await verifier.verify(task, "Researcher", "Writer", msg);
    console.log("Verifier Result:", JSON.stringify(result, null, 2));
    if (result.verdict && result.suggested_actions) {
      console.log("✅ Verifier parsing successful");
    } else {
      console.log("❌ Verifier parsing failed");
    }
  } catch (e) {
    console.log("❌ Verifier test error:", e);
  }

  console.log("\n🎉 All tests completed!");
}

runTests().catch(console.error);
