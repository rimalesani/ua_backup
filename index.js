import { google } from 'googleapis';
import {BigQuery as _BigQuery} from '@google-cloud/bigquery';

//Create the main constants:
const scopes = "https://www.googleapis.com/auth/analytics.readonly";
const clientkey = process.env.CLIENT;
const pkey = process.env.PKEY;
const view_id = process.env.VIEW;
const BigQuery = _BigQuery;
const project = process.env.PRJ;
const dataset = process.env.DATASET; 
const table = process.env.TABLE;
const bigquery = new BigQuery({projectId: project});
const jwt = new google.auth.JWT(
  clientkey,
  null,
  pkey.replace(/\\n/g, "\n"),
  scopes
);

//Start defining the main getData entry point:
export const getData = () => {

  //Start defining the writeBQ function to insert the fetched data into BQ:
  let writeBQ = async function(data,columns) {
      const inserted = [];
      for(const part of data) {
        var toInsert = {};  
        var counter = 0;
        //Making the final array based on the data types, handling special cases of DATE and FLOAT:
        for (var prop in columns) {
          counter++;
          toInsert[prop] = columns[prop]=="DATE" ? bigquery.date(part[counter-1].substring(0,4)+"-"+part[counter-1].substring(4,6)+"-"+part[counter-1].substring(6,8)) : 
                           columns[prop].match(/FLOAT/) ? parseFloat(part[counter-1]).toFixed(2) : 
                           part[counter-1];
        }
        inserted.push(toInsert);
      }

      function queryColumns(columns,pattern) {
        var construct = "";
        for (var prop in columns) {
          if (pattern=="ON") construct += "AND t." + prop + " = s." + prop + " ";
          else if (pattern=="INSERT") construct += prop + ", ";
          else construct += "s." + prop + ", ";
        }
        return pattern=="ON" ? construct.substring(4,construct.length) : construct.substring(0,construct.length-2);
      }

      const tableId = "`"+dataset+"." + table + "`"; 
      const insertQuery = `
          MERGE ${tableId} t
          USING UNNEST(@rows) s
          ON ${queryColumns(columns,"ON")}
          WHEN NOT MATCHED THEN
            INSERT ( ${queryColumns(columns,"INSERT")} ) 
            VALUES ( ${queryColumns(columns,"")} )`;

        const options = {
            query: insertQuery,
            location: 'europe-west8',
            params: {rows: inserted},
            types: {rows: [columns]}
        };

        const [job] = await bigquery.createQueryJob(options);
        const [rows] = await job.getQueryResults();
        console.log('inserted '+ inserted.length +' rows');

   }

  //Start defining the getSchema for fetching the destination table columns types:
  let getSchema = async function(data) {
    const getQuery = `
          SELECT column_name, data_type as columns
          FROM \`${dataset}\`.INFORMATION_SCHEMA.COLUMNS
          WHERE table_name = "${table}"`;

        const options = {
            query: getQuery,
            location: 'europe-west8'
        };
        const [job] = await bigquery.createQueryJob(options);
        const [schema] = await job.getQueryResults();
        var schema_obj = {};
        for (var sch of schema) schema_obj[sch.column_name] = sch.columns;
        writeBQ(data,schema_obj);
  }

  //Start asynchronously running the main part of the script:
  void async function () {
  try {
    await jwt.authorize();

    //Dynamically retrieving the dimensions and metrics from the destination table:
    const getQuery = `
          SELECT column_name, description
          FROM \`${dataset}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
          WHERE table_name = "${table}"`;

    const options = {
        query: getQuery,
        location: 'europe-west8'
    };
    const [job] = await bigquery.createQueryJob(options);
    const [meta] = await job.getQueryResults();
    var predimensions = "";
    var premetrics = "";
    for (var part of meta) {
      if (part.description=="dimension") predimensions+="ga:"+part.column_name+",";
      else if (part.description=="metric") premetrics+="ga:"+part.column_name+",";
    }          
    const dimensions = predimensions.substring(0,predimensions.length-1);
    const metrics = premetrics.substring(0,premetrics.length-1);

    var countStart = 1;
    let res = true;
    while(res) {

      //The following response constant creates the API request options:
      const response = await google.analytics("v3").data.ga.get({
        auth: jwt,
        ids: "ga:" + view_id,
        "start-date": process.env.STARTDATE,
        "end-date": process.env.ENDDATE,
        dimensions: dimensions,
        metrics: metrics,
        "max-results": "10000",
        "start-index": countStart,
        "sampling-level": "HIGHER_PRECISION",
        //filters: process.env.FILTERS, -- Uncomment this if you use Filters and the environment variable for that
        //segments: process.env.SEGMENTS -- Uncomment this if you use Filters and the environment variable for that
      })
      
      res = await response.data;
      if(res.rows) {
        countStart+=10000
        getSchema(res.rows);
      } 
      if (res.rows && res.rows.length<10000) {
        break;
      }
    }

  } catch (err) {
     console.log(err);
  }

  }();
};