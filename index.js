const http = require('http');
const axios = require('axios');
const { DateTime } = require('luxon');

const BASE_URL = 'https://academy.unblindedmastery.com/admin/api/v2/';
const eventLogsUrl = `${BASE_URL}event-logs`;
const userDetailsUrl = `${BASE_URL}users/`;
const headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer NaGH96mLlGQyDCndDaaxotRdUUhC5OYM9Kcr7zyD',
  'Lw-Client': '5e318802ce0e77a1d77ab772'
};

const getUserDetails = async (userId) => {
  try {
    const userResponse = await axios.get(`${userDetailsUrl}${userId}`, { headers });

    if (userResponse.status === 200) {
      return { email: userResponse.data.email };
    } else {
      console.error(`Error fetching user details for ID ${userId}. Status code: ${userResponse.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching user details for ID ${userId}. ${error.message}`);
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const currentDateTime = DateTime.local();
    const daysUntilWednesday = (currentDateTime.weekday - 2 + 7) % 7;
    const adjustedDate = currentDateTime.minus({ days: daysUntilWednesday });
    
    const createdAfter = Math.floor(adjustedDate.toSeconds());
    const createdBefore = Math.floor(adjustedDate.plus({ days: 7 }).toSeconds());
    
    const params = {
      activity: 'live_session_attended',
      created_after: createdAfter,
      created_before: createdBefore,
      page: 1
    };

    const response = await axios.get(eventLogsUrl, { headers, params });
    const responseData = response.data.data || [];
    
    const userDetailsPromises = responseData.map(async (item) => {
      const { user: { id: userId }, activity, created, additional_info: { course } = {} } = item;
      const userDetails = await getUserDetails(userId);
      if (userDetails) {
        return { user_id: userId, activity, created, course, ...userDetails };
      }
      return null;
    });

    const userDetailsList = (await Promise.all(userDetailsPromises)).filter(Boolean);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(userDetailsList));
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
