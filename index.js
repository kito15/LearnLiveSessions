const http = require('http');
const axios = require('axios');
const { DateTime } = require('luxon');

const BASE_URL = 'https://academy.unblindedmastery.com/admin/api/v2/';
const eventLogsUrl = `${BASE_URL}event-logs`;
const userDetailsUrl = `${BASE_URL}users/`;
const headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer 2rEqc6KTe1IRoUG7BTG0Ybw8IC63pJW40thoPDSP',
  'Lw-Client': '5e318802ce0e77a1d77ab772',
};

const salesforceCredentials = {
  client_id: '3MVG9p1Q1BCe9GmBa.vd3k6U6tisbR1DMPjMzaiBN7xn.uqsguNxOYdop1n5P_GB1yHs3gzBQwezqI6q37bh9',
  client_secret: '1AAD66E5E5BF9A0F6FCAA681ED6720A797AC038BC6483379D55C192C1DC93190',
  username: 'admin@unblindedmastery.com',
  password: 'Unblinded2023$',
};

const getSalesforceAccessToken = async () => {
  try {
    const response = await axios.post(
      'https://login.salesforce.com/services/oauth2/token',
      `grant_type=password&client_id=${salesforceCredentials.client_id}&client_secret=${salesforceCredentials.client_secret}&username=${salesforceCredentials.username}&password=${salesforceCredentials.password}`
    );

    if (response.status === 200 && response.data.access_token) {
      return response.data.access_token;
    } else {
      console.error('Error obtaining Salesforce access token:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Error obtaining Salesforce access token:', error.message);
    return null;
  }
};

const findSalesforceAccountId = async (email, accessToken) => {
  try {
    const response = await axios.get(
      `https://unblindedmastery.lightning.force.com/services/data/v58.0/query/?q=SELECT+Id+FROM+Account+WHERE+Email__c='${email}'`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 200 && response.data.records.length > 0) {
      return response.data.records[0].Id;
    } else {
      console.error(`Error finding Salesforce account ID for email ${email}:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`Error finding Salesforce account ID for email ${email}:`, error.message);
    return null;
  }
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
    const startDate = DateTime.fromObject({ year: 2024, month: 1, day: 3 });
    const endDate = DateTime.fromObject({ year: 2024, month: 1, day: 5 });

    const createdAfter = Math.floor(startDate.toSeconds());
    const createdBefore = Math.floor(endDate.endOf('day').toSeconds());

    const params = {
      activity: 'live_session_attended',
      created_after: createdAfter,
      created_before: createdBefore,
      page: 1
    };

    const response = await axios.get(eventLogsUrl, { headers, params });
    const responseData = response.data.data || [];

    const accessToken = await getSalesforceAccessToken();

    if (accessToken) {
      const userDetailsWithSalesforceIds = await Promise.all(
        responseData.map(async (item) => {
          const { user: { id: userId }, activity, created, additional_info: { course } = {} } = item;
          const userDetails = await getUserDetails(userId);
          
          if (userDetails) {
            const { email } = userDetails;
            const accountId = await findSalesforceAccountId(email, accessToken);

            if (accountId) {
              return { user_id: userId, activity, created, course, email, salesforce_account_id: accountId };
            }
          }

          return null;
        })
      );

      const filteredUserDetails = userDetailsWithSalesforceIds.filter(Boolean);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(filteredUserDetails));
    } else {
      console.log('Failed to obtain Salesforce access token. Check the error messages above.');
    }
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
