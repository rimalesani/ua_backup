# ua_backup
A Node.js module, meant to be used in Google Cloud Functions or Cloud Run environments, to easily and quickly extract Google Universal Analytics data and store it in a Google BigQuery table of choice.

# intro

The script has no external dependancies other than standard GoogleAPIs and BigQuery packages, both included in your Google Cloud project. This means no further installations are needed.<br>
The script is meant to be used with Node.js v.20 but it's also tested on preview v.22.<br>
The code is fully designed to work asynchronously, so let's grab a cup of coffee while you wait for the data to come in.<br>
For about 100.000 rows, it usually takes around 1 minute.<br><br>
The script relies on the following environment variables (the dynamic values you can set on Cloud Function and Cloud Run):<br>
- CLIENT: the Service Account email you need to setup in Google Cloud as project Owner<br>
- PKEY: the private key you will download from this Service Account settings. <u>Note</u>: Usually the private key shouldn't be exposed, but for simplicity we assume the Google Cloud project user is the only one using this script.<br>
- VIEW: the UA View ID from which you want to fetch the data<br>
- TABLE: the BigQuery table to which you're going to save the fetched data<br>
- STARTDATE: the first date of data extraction (YYYY-MM-dd format)<br>
- ENDDATE: the final date of data extraction (YYYY-MM-dd format)<br>
- DATASET: the BigQuery dataset of TABLE<br>
- PRJ: the Google Cloud project id of DATASET<br><br>
One of the cool things of this script is the Dimensions and Metrics are automatically recognized from the TABLE you will use for saving the data.
In addition to that, any metric meant to be set as FLOAT field in the BigQuery TABLE (I.e: "sessionsPerUser", "avgSessionDuration" or "goalConversionRateAll", ...) will be rounded to 2 decimals.

# installation

1) Enable the Google Analytics Reporting API at this link: https://console.cloud.google.com/apis/api/analyticsreporting.googleapis.com/
2) Set a new Service Account in IAM (identities management of your GCP project) and give the "View" privilege to the Universal Analytics properties that include the Views where you want to get the data from.
3) Go to the Service Account details and move to "Key" section. Add a new JSON key and dowload it.
4) In your Cloud Function or Cloud Run environment, create a new service with the following configurations:<br>
   - Memory allocated: 1 GB (increase in case of huge volumes of data, but this should be enough)
   - CPU: 1
   - Timeout: 540 seconds
   - Minimum instances: 1
   - Max instances: 100
   - Concurrency: 1
5) Create as many enviroment variables as specified above in the #intro. For the PKEY variable, paste the complete value you find in the downloaded JSON key, including the "-----BEGIN PRIVATE KEY-----" and "\n-----END PRIVATE KEY-----\n" prefix and suffix.<br><br>
   ![image](https://github.com/rimalesani/ua_backup/assets/169257832/91d4d23c-bb02-419c-9110-15281539ce08)<br><br>
6) Go to BigQuery and create a new TABLE in your dedicated dataset. The TABLE should always start with a "date" field of DATE type, that you will use for partitioning (by day). Then, in the order, you create the dimensions fields and the metrics fields as the last ones. For the Dimensions and Metrics fields you have to use the APIs fields names in "camel case" (you can refer here: https://ga-dev-tools.google/dimensions-metrics-explorer/). Moreover, you need to write "dimension" or "metric" in the field description ("date" field included). In this way, the script will know how to parse the specific field.<br><br>
   ![image](https://github.com/rimalesani/ua_backup/assets/169257832/8744b92e-9d88-4219-9c37-ad29dddc32e9)<br>
   ![image](https://github.com/rimalesani/ua_backup/assets/169257832/1195b8ee-c76e-4b85-b631-4eff50e440fe)<br><br>
   Other than DATE field type, you can use INTEGER (absolute metrics) and FLOAT for decimal or rates.
7) Go back to your Cloud Run or Cloud Function service and deploy it, you're good to go !

# operations

Now it's time to singularly or recurringly run your extractions.<br>
For this purpose, I liked to create an EventArc trigger (via Cloud Pub Sub) connected to a Cloud Scheduler job that I can manually force to run. This way, my extraction from Google Analytics are done on demand.<br>
You have plenty of choices depending on your case and needs.<br>
The script handles pagination, meaning it goes up to 10.000 rows (the API limit for one request) and then it dynamically switch to the second results page with the same limit.<br>
Every 10.000 results well written into BigQuery, the script logs "inserted xx rows" where xx is the number of written rows in your table. For example, this means for 99.984 rows, the following logs are expected:<br><br>
![image](https://github.com/rimalesani/ua_backup/assets/169257832/e64cf5b3-fcb7-4609-86ac-4417f417407f)<br><br>
If you need Filters or Segments, you need to uncomment the dedicated part of the API call options at the end of index.js main source. Use the "ga:..." notation and refer to the API guidelines.

# license

You're free to use, share and modify this code upon need. Just include the MIT License permission notice on top of your code. Look at LICENSE here for more.



