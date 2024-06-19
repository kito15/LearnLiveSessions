const http = require('http');
const axios = require('axios');
const { DateTime } = require('luxon');

const BASE_URL = 'https://academy.unblindedmastery.com/admin/api/v2/';
const eventLogsUrl = `${BASE_URL}event-logs`;
const userDetailsUrl = `${BASE_URL}users/`;
const headers = {
  'Accept': 'application/json',
  'Authorization': 'Bearer 2rEqc6KTe1IRoUG7BTG0Ybw8IC63pJW40thoPDSP',
  'Lw-Client': '5e318802ce0e77a1d77ab772'
};

const salesforceCredentials = {
  client_id: '',
  client_secret: '',
  username: 'admin@unblindedmastery.com',
  password: '',
  grant_type: 'password',
};

const salesforceBaseUrl = 'https://unblindedmastery.my.salesforce.com';
const tokenEndpoint = `${salesforceBaseUrl}/services/oauth2/token`;

const getAccessToken = async () => {
  try {
    const response = await axios.post(tokenEndpoint, null, {
      params: {
        grant_type: salesforceCredentials.grant_type,
        client_id: salesforceCredentials.client_id,
        client_secret: salesforceCredentials.client_secret,
        username: salesforceCredentials.username,
        password: salesforceCredentials.password,
      },
    });

    if (response.status === 200) {
      const accessToken = response.data.access_token;
      console.log('Access Token:', accessToken);
      return accessToken;
    } else {
      console.error(`Error obtaining access token. Status code: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error obtaining access token. ${error.message}`);
    return null;
  }
};

const getSalesforceAccountId = async (email, accessToken) => {
  try {
    const salesforceApiEndpoint = `${salesforceBaseUrl}/services/data/v58.0/query/`;
    const query = `SELECT Id FROM Account WHERE Email__c = '${email}'`;

    const response = await axios.get(salesforceApiEndpoint, {
      params: { q: query },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 200 && response.data.records.length > 0) {
      return response.data.records[0].Id;
    } else {
      console.error(`Error fetching Salesforce account ID for email ${email}. Status code: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching Salesforce account ID for email ${email}. ${error.message}`);
    return null;
  }
};

const getUserDetails = async (userId, accessToken) => {
  try {
    const userResponse = await axios.get(`${userDetailsUrl}${userId}`, { headers });

    if (userResponse.status === 200) {
      const { email } = userResponse.data;
      const salesforceAccountId = await getSalesforceAccountId(email, accessToken);

      return { email, salesforce_account_id: salesforceAccountId };
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
    const accessToken = await getAccessToken();

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

    const userDetailsPromises = responseData.map(async (item) => {
      const { user: { id: userId }, activity, created, additional_info: { course } = {} } = item;
      const userDetails = await getUserDetails(userId, accessToken);
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
