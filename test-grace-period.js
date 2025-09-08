// Test script to verify grace period logic
const testGracePeriod = () => {
    console.log('🧪 Testing Grace Period Logic\n');

    // Function from our implementation
    const isGracePeriod = (testDate) => {
        const utcDay = testDate.getUTCDay(); // 0 = Sunday
        const utcHour = testDate.getUTCHours();
        const utcMinute = testDate.getUTCMinutes();
        return utcDay === 0 && utcHour === 15 && utcMinute >= 0 && utcMinute < 30;
    };

    // Test cases
    const testCases = [
        {
            name: 'Sunday 14:59 UTC (Before grace period)',
            date: new Date('2024-09-08T14:59:00Z'), // Assuming Sept 8 is Sunday
            expected: false
        },
        {
            name: 'Sunday 15:00 UTC (Grace period start)',
            date: new Date('2024-09-08T15:00:00Z'),
            expected: true
        },
        {
            name: 'Sunday 15:15 UTC (Mid grace period)',
            date: new Date('2024-09-08T15:15:00Z'),
            expected: true
        },
        {
            name: 'Sunday 15:29 UTC (End of grace period)',
            date: new Date('2024-09-08T15:29:00Z'),
            expected: true
        },
        {
            name: 'Sunday 15:30 UTC (After grace period)',
            date: new Date('2024-09-08T15:30:00Z'),
            expected: false
        },
        {
            name: 'Monday 15:15 UTC (Not Sunday)',
            date: new Date('2024-09-09T15:15:00Z'),
            expected: false
        }
    ];

    testCases.forEach(test => {
        const result = isGracePeriod(test.date);
        const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${test.name}`);
        console.log(`   Expected: ${test.expected}, Got: ${result}`);
        console.log(`   Date: ${test.date.toISOString()}`);
        console.log('');
    });

    // Test current time
    const now = new Date();
    const currentResult = isGracePeriod(now);
    console.log(`🕐 Current Time Test:`);
    console.log(`   Now: ${now.toISOString()}`);
    console.log(`   Day: ${now.getUTCDay()} (0=Sunday)`);
    console.log(`   Hour: ${now.getUTCHours()}`);
    console.log(`   Minute: ${now.getUTCMinutes()}`);
    console.log(`   Is Grace Period: ${currentResult}`);
};

testGracePeriod();
