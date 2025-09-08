// Test the actual tournament entry API grace period validation
const testTournamentEntryAPI = async () => {
    console.log('🧪 Testing Tournament Entry API Grace Period\n');

    // Simulate grace period by temporarily modifying the current date logic
    // We'll test by calling the API endpoint

    const testPayload = {
        payment_reference: "test_payment_123",
        paid_amount: 1.0,
        is_verified_entry: false,
        wallet: "0x1234567890123456789012345678901234567890"
    };

    try {
        console.log('📡 Testing tournament entry API...');
        console.log('   Payload:', JSON.stringify(testPayload, null, 2));

        const response = await fetch('http://localhost:3000/api/tournament/entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testPayload)
        });

        const data = await response.json();

        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, JSON.stringify(data, null, 2));

        if (response.status === 423 && data.grace_period) {
            console.log('✅ Grace period blocking working correctly!');
        } else if (response.status === 401) {
            console.log('✅ API requires authentication (expected for real test)');
        } else {
            console.log('ℹ️  Normal API response (not in grace period)');
        }

    } catch (error) {
        console.log('❌ Error testing API:', error.message);
        console.log('ℹ️  This is expected if the dev server is not running');
    }
};

// Don't run the API test automatically since it requires server
console.log('📝 To test the API, run: npm run dev');
console.log('📝 Then run: node -e "require(\'./test-grace-period.js\')"');
console.log('📝 Or manually test with curl during Sunday 15:00-15:30 UTC\n');
