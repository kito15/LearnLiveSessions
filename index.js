const http = require('http');
const axios = require('axios');
const { DateTime } = require('luxon');

const BASE_URL = 'https://academy.unblindedmastery.com/admin/api/v2/';

const eventLogsUrl = BASE_URL + 'event-logs';
const userDetailsUrl = BASE_URL + 'users/';
const headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer fezWGXG2kVxMoyNeEM9JhAEum5JAFFFneExlMBzi',
  'Lw-Client': '5e318802ce0e77a1d77ab772'
};

const server = http.createServer((req, res) => {
  const currentDateTime = DateTime.local();
  const daysUntilWednesday = (currentDateTime.weekday - 2 + 7) % 7;
  const adjustedDate = currentDateTime.minus({ days: daysUntilWednesday });

  const createdAfter = Math.floor(adjustedDate.toSeconds());
  const createdBefore = Math.floor(adjustedDate.plus({ days: 7 }).toSeconds());

  const params = {
    'activity': 'live_session_attended',
    'created_after': createdAfter,
    'created_before': createdBefore,
    'page': 1
  };

  axios.get(eventLogsUrl, { headers, params })
    .then(response => {
      const responseData = response.data.data || [];
      const userDetailsList = [];

      const getUserDetails = async (userId, activity, created, course) => {
        try {
          const userResponse = await axios.get(`${userDetailsUrl}${userId}`, { headers });

          if (userResponse.status === 200) {
            const userEmail = userResponse.data.email;
            userDetailsList.push({
              'user_id': userId,
              'email': userEmail,
              'activity': activity,
              'created': created,
              'course': course
            });
          } else {
            console.error(`Error fetching user details for ID ${userId}. Status code: ${userResponse.status}`);
          }
        } catch (error) {
          console.error(`Error fetching user details for ID ${userId}. ${error.message}`);
        }
      };

      const promises = responseData.map(async (item) => {
        const userId = item.user.id;
        const activity = item.activity;
        const created = item.created;
        const course = item.additional_info ? item.additional_info.course : null;

        await getUserDetails(userId, activity, created, course);
      });

      Promise.all(promises)
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(userDetailsList));
        })
        .catch(error => {
          console.error(`Error processing user details: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
    })
    .catch(error => {
      console.error(`Error fetching event logs: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
