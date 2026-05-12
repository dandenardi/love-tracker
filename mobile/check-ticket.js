
async function checkTicket(ticketId) {
  console.log(`Checking status for ticket: ${ticketId}...`);
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: [ticketId],
      }),
    });

    const result = await response.json();
    console.log('\n--- DIAGNOSTIC RESULT ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('-------------------------\n');

    const status = result.data?.[ticketId]?.status;
    if (status === 'ok') {
      console.log('✅ EXPO SUCCESS: Expo delivered the message to Google (FCM).');
      console.log('If it didn\'t arrive, check the physical device for:');
      console.log('1. Battery Optimization (Set to "No restrictions")');
      console.log('2. Google Play Services (Check if logged in)');
      console.log('3. Notification Permissions');
    } else if (status === 'error') {
      const details = result.data?.[ticketId]?.details?.error;
      console.log(`❌ ERROR: ${result.data?.[ticketId]?.message}`);
      if (details === 'DeviceNotRegistered') {
        console.log('Suggestion: The push token is old or invalid. Logout and Login again on the device.');
      } else if (details === 'MessageTooBig') {
        console.log('Suggestion: Payload is too large.');
      } else {
        console.log(`Error details: ${details}`);
      }
    } else {
      console.log('❓ UNKNOWN: No receipt found for this ID yet. Wait a few seconds and try again.');
    }
  } catch (err) {
    console.error('Failed to connect to Expo API:', err.message);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node check-ticket.js <TICKET_ID>');
} else {
  checkTicket(args[0]);
}
