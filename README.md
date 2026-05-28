# Custom Utility Network widget documentation

![demo_wml](https://github.com/user-attachments/assets/e226d0dd-6a1e-4a58-adc2-4230025c34ca)

## Introduction
This widget is a custom trace widget for ArcGIS Experience Builder. It has been developped for WML to be integrated in an ArcGIS Experience Builder web application called WaterWeb.

A business-critical functionality of WaterWeb is the isolation trace, which can be used in case of a leakage to identify which valves need to be closed to stop the water flow and which customers will be affected by the water outage.

WML distinguishes between several types of customers. The two most important types are the ‘Key Accounts’ and the ‘Kidney Dialysis’ customers. Key Accounts are connections like industrial companies for which a water outage has large consequences. They simply cannot
afford to lose their water supply, even for a short period of time. Kidney Dialysis customers require water for dialysis. For them, a water outage could create a life-threatening situation.

For WML, it is essential that the results of an isolation trace in WaterWeb are sorted based on priority, i.e. first the Kidney Dialysis customers, then the Key Accounts, followed by all other connections. This helps them to prioritise their actions and inform customers.

The ESRI Utility Network Trace widget allows the user to sort the results of a trace based on a chosen field. However, this can only be done manually after running the trace. 

This custom widget for ArcGIS Experience Builder looks and behaves the same as the ESRI Utility Network Trace widget but the critical information is displayed to the user directly after running a trace, with no extra clicks required. The critical information (the trace results) is sorted by priority : 
1. Kidney Dialysis,
2. Key Accounts,
3. The rest.

## Widget behaviour

<ins>**Configure the widget**</ins>
- Open Experience Builder developper edition.
- Create an application and add a map to the application.
- Add the custom widget to the application.
- Select the map on which the custom widget will perform the trace.

<img width="1912" height="922" alt="image" src="https://github.com/user-attachments/assets/cdf5cc10-85fd-406f-af2c-13100f5c29d2" />

\
<ins>**Perform a trace**</ins>
- Select starting points on the map for the trace.
- You have the possibility to delete the points and start again.

<img width="1580" height="533" alt="image" src="https://github.com/user-attachments/assets/e6c507b4-f72e-49e0-81f9-382e7eb38353" />

- Run the trace.
- The trace is in progress. It takes a couple secondes.
- The widget switches on the "Results tab".
- The results are highlighted in green on the map.
- The list of results is sorted by priority.

<img width="1913" height="925" alt="image" src="https://github.com/user-attachments/assets/7d6d14fd-9058-4047-983a-1d9d1e633323" />

- You can clear all results and perform an other trace.

## Specifications
The development of this custom widget involves the following software:
- ArcGIS Maps SDK for JavaScript.
- React: a JavaScript library for User Interfaces.
- TypeScript: a superset of JavaScript.
- JSX: a JavaScript extension for designing User Interfaces.
- Jimu: a JavaScript library for building widgets.

Software versions used for the widget development
- ArcGIS Experience Builder Developer Edition - **1.17**
- ArcGIS Maps SDK for JavaScript (JSAPI) - **4.32.10**
- Node.js - **22.15.0**
- React.js - **18.3.1**

For more informations about software versions, read the documentation : https://developers.arcgis.com/experience-builder/guide/release-versions/

## Code documentation
To be functional, the custom widget must be located at a specific place on your machine.

It must be located where you have installed ArcGIS Experience Builder developper edition and more specifically in \client\your-extensions\widgets. 

For example : *C:\arcgis-experience-builder-1.17\ArcGISExperienceBuilder\client\your-extensions\widgets\custom_UNT_widget*

Inside the widget directory, you will find 7 files.

- manifest.json
- config.json
- src\setting\setting.tsx
- src\runtime\widget.tsx
- widget.scss (for style)
- README.md (for this documentation)
- icon.svg (icon)

The first 4 files will be explained in the next sections.

### manifest.json
Each ArcGIS Experience Builder widget has a manifest.json file, which describes the widget's attributes and properties.

A widget manifest needs to include the name, type, version, exbVersion, and translatedLocales properties.

The name must be the same as the folder name, otherwise it will not work. In our case, it is custom_UNT_widget but it can be modified.

### config.json
To successfully perform the trace and display the results, the widget needs to make requests to the Utility Network layers Feature service and to the Utility Network trace service.

As a consequence, the config.json file contains 4 variables :
- UTILITY_NETWORK_FEATURE_SERVER_URL -> URL of the Feature Service containing all the layers of the Utility Network
- UTILITY_NETWORK_SERVICE_URL -> URL of the Utility Network service used to run the trace
- TRACE_GLOBAL_ID -> Trace global ID
- TRACE_TYPE : isolation

These variables are used in the widget.tsx file, by writing "config.NAME_OF_VARIABLE".

The trace type should not change in the future.
If the layers or services URL mentionned in this config file are republished, make sure that the values in this file are still correct.

For instance, if you encounter the error “A requested row object could not be located”, there is a good chance that the Utility Network has been published again and that you need to update the TRACE_GLOBAL_ID value in the config file.
<img width="923" height="576" alt="error trace_globalid" src="https://github.com/user-attachments/assets/01d63b6c-77c0-4862-8eb2-3a9aa0d82f29" />

### src\setting\setting.tsx
This setting file has only one purpose.
It allows selecting the map on which the custom widget will perform the trace.

### src\runtime\widget.tsx
This is the main file of the widget, where the logic is written to perform the trace. 

The main steps are :

#### <ins>getToken function</ins>
As the widget needs to make requests to the Utility Network layers Feature service and to the Utility Network trace service, we need to have a function to get a token.

This first function getToken, as its name suggests, allows to get a token which will be used multiple times later to query layers or to run traces.

#### <ins>getAssetGroupAndTypeCombinations function</ins>
The function getAssetGroupAndTypeCombinations is triggered one time at the begining, when the application start.

This function make a request to the Utility Network layers Feature service and returns an object with all asset groups and asset types existing in the dataset.

This will be useful later.
```
[
    {
        "id": 1,
        "assetGroup": "Leiding",
        "code": 0,
        "assetType": "Onbekend",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/3"
    },
    {
        "id": 1,
        "assetGroup": "Leiding",
        "code": 1,
        "assetType": "Primair",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/3"
    },
    {
        "id": 1,
        "assetGroup": "Leiding",
        "code": 2,
        "assetType": "Secundair",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/3"
    },
    ...
]
```

#### <ins>Point selection</ins>
To be able to select points by clicking on the map, the variable *isSelectionMode* must be *True*. *isSelectionMode* become *True* when the user click on the button "Add point" and become *False* when the user click again on this button or after selecting a point.

When the user click on the map to select a starting point, this is what happens :
- Check if *isSelectionMode* is *True*
- We get the point coordinates
- We check if the point intersects an object on the map. For this:
- We loop on each layer (except Subnetwerk) and for each visible layer we make a spatial request

```
const results = await layer.queryFeatures({
	geometry: point,
	spatialRelationship: "intersects",
	distance: 0.2,
	units: "meters",
	outFields: ["*"],
	returnGeometry: true
});
```

- If results in not empty, it means our point intersects 1 or many objects
- For each intersected object, we check if it is a point or a polyline
- If the object is a point, it is easy, we save its globaid and its type (point) and add it to an array called traceLocations
- Otherwise, if the object is a polyline, we need to know where our point intersects the polyline. For this :
	- We find the closest point on the polyline of the selected point
 	- We calculate the distance along the polyline from the first vertex to this new point
  	- We save the globalid, the percentage along the polyline and its type (polyline) and add it to the array called traceLocations
 - We add a marker on the map (green point) for the selected point

For example, we have seleted 2 starting points. 

First one is intersecting a polyline with a length equal to 34.19 and globalid equal to {7788EB33-9CFC-4254-B46D-0983D16DE865}

Second one is intersecting :
- a polyline with a length equal to 12.14 and globalid equal to {AA9587B0-AED3-49DB-89E6-F49A44DD88C8}
- a point with globalid equal to {6327095B-DD00-4904-98A8-096E6561D99D}

Selected features variable is :
```
[
    [
        "{7788EB33-9CFC-4254-B46D-0983D16DE865} - 34.19517675053019 - polyline"
    ],
    [
        "{6327095B-DD00-4904-98A8-096E6561D99D} - point",
        "{AA9587B0-AED3-49DB-89E6-F49A44DD88C8} - 12.144028738516036 - polyline"
    ],
    [
        "{6327095B-DD00-4904-98A8-096E6561D99D} - point",
        "{AA9587B0-AED3-49DB-89E6-F49A44DD88C8} - 12.144028738516036 - polyline"
    ]
]
```

And trace locations variable is : 
```
[
    "{\"globalId\":\"{7788EB33-9CFC-4254-B46D-0983D16DE865}\",\"isFilterBarrier\":false,\"percentAlong\":0.3526599238776603,\"traceLocationType\":\"startingPoint\"}",
    "{\"globalId\":\"{6327095B-DD00-4904-98A8-096E6561D99D}\",\"isFilterBarrier\":false,\"terminalId\":1,\"traceLocationType\":\"startingPoint\"}",
    "{\"globalId\":\"{AA9587B0-AED3-49DB-89E6-F49A44DD88C8}\",\"isFilterBarrier\":false,\"percentAlong\":0.9982093139322438,\"traceLocationType\":\"startingPoint\"}"
]
```

#### <ins>Run trace</ins>
To perform the trace, we need to request the Utility Network service used to run the trace and to provide some parameters.

```
const traceUrl = `${config.UTILITY_NETWORK_SERVICE_URL}/trace`

const traceParams = {
	traceConfigurationGlobalId: config.TRACE_GLOBAL_ID,
	traceLocations: '['+traceLocations+']',
	traceType: config.TRACE_TYPE,
	f: 'json'
}
```

If the trace did not perform well and encountered an issue, the error is displayed to user and in the developer console.
<img width="923" height="576" alt="error trace_globalid" src="https://github.com/user-attachments/assets/c5cb2c5e-0dd2-4eef-a1d1-06f350b33212" />

It is also possible to cancel the trace while it is running. This is made possible with React AbortController and the function handleCancelTrace().

After being returned, the results are processed to be enhanced.

For some reasons, duplicated values exist in the results so we need to remove these duplicates first.


#### <ins>removeDuplicatesByMultipleAttrsFromTraceResults function</ins>
This is the function that clean and remove all the duplicates from the results.

A new variable called *uniqueTraceResults* is created and contains an array of unique objects, with the following attributes.
```
[
    {
        "networkSourceId": 9,
        "globalId": "{097AE482-0015-4532-96AD-8B1D0F4F5730}",
        "objectId": 15262,
        "terminalId": 1,
        "assetGroupCode": 12,
        "assetTypeCode": 65
    },
    {
        "networkSourceId": 9,
        "globalId": "{2476CAE3-AF62-44EB-B250-DA5C1274C446}",
        "objectId": 7469,
        "terminalId": 1,
        "assetGroupCode": 7,
        "assetTypeCode": 321
    },
    {
        "networkSourceId": 9,
        "globalId": "{9146AC42-26B2-452D-9A6E-2C7CA1750245}",
        "objectId": 15385,
        "terminalId": 1,
        "assetGroupCode": 12,
        "assetTypeCode": 61
    },
	...
]
```

#### <ins>addAssetGroupAndTypeNamesToResults function</ins>
We merge the (unique) results of the trace to the assetGroupAndTypeCombinations variable to add the asset groups, asset types and feature layer to the results.

We obtain a new variable *uniqueTraceResultsWithAssetGroupAndTypeNames* :
```
[
    {
        "networkSourceId": 9,
        "globalId": "{097AE482-0015-4532-96AD-8B1D0F4F5730}",
        "objectId": 15262,
        "terminalId": 1,
        "assetGroupCode": 12,
        "assetTypeCode": 65,
        "assetGroup": "Aansluiting",
        "assetType": "Huishoudelijk",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/0"
    },
    {
        "networkSourceId": 9,
        "globalId": "{2476CAE3-AF62-44EB-B250-DA5C1274C446}",
        "objectId": 7469,
        "terminalId": 1,
        "assetGroupCode": 7,
        "assetTypeCode": 321,
        "assetGroup": "Brandkraan",
        "assetType": "Brandkraan",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/0"
    },
    {
        "networkSourceId": 9,
        "globalId": "{9146AC42-26B2-452D-9A6E-2C7CA1750245}",
        "objectId": 15385,
        "terminalId": 1,
        "assetGroupCode": 12,
        "assetTypeCode": 61,
        "assetGroup": "Aansluiting",
        "assetType": "Zakelijk",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/0"
    },
    ...
]
```

#### <ins>Get all attributes </ins>
As we want to display different informations about the results and we now have the feature layer url associated to the results elements, we are going to query the feature layers to get the attributes.

To reduce the number of requests, elements with the same feature layer url are grouped together, with a batch size of 100 elements.
```
const batchSize = 100;

const whereClause = `globalId IN (${batch.map(item => `'${item.globalId}'`).join(",")})`;      
const url = `${featureLayerUrl}/query`;

const requestParams = {
	where: whereClause,
	outFields: "*",
	f: "json"
};

const response = await esriRequest(url, {
	query: {
	...requestParams,
	token
},
	method: "post",
	responseType: "json"
});
```

We also create 2 new attributes *displayField* and *displayFieldComplement*, which will diplay the important informations to the end user in the widget.

All unique results have now all the informations needed.

*uniqueTraceResultsWithAllAttributes* variable :
```
[
    {
        "networkSourceId": 9,
        "globalId": "{133D7C60-1B93-4038-BF7F-132EE724E0FD}",
        "objectId": 5125,
        "terminalId": 1,
        "assetGroupCode": 6,
        "assetTypeCode": 176,
        "assetGroup": "Service afsluiter",
        "assetType": "Dienstkraan",
        "featureLayerUrl": "https://arcgisenterprise.tensing.com/arcgis/rest/services/WML/WML_Vaals/FeatureServer/0",
        "objectid": 5125,
        "assetgroup": 6,
        "assettype": 176,
        "associationstatus": 0,
        "issubnetworkcontroller": 0,
        "isconnected": 1,
        "subnetworkcontrollername": "Unknown",
        "tiername": 0,
        "tierrank": 0,
        "terminalconfiguration": "Default",
        "globalid": "{133D7C60-1B93-4038-BF7F-132EE724E0FD}",
        "dmasubnetworkname": "Unknown",
        "supportedsubnetworkname": "Unknown",
        "supportingsubnetworkname": "Unknown",
        "systemsubnetworkname": "Verzorgingsgebied Enwor Vaals 43",
        "pressuresubnetworkname": "Drukzone Inkoop Vaals 43(3)",
        "cpsubnetworkname": "Unknown",
        "creationdate": 1551265200000,
        "creator": "Avineon: rsaladi",
        "lastupdate": 1553166000000,
        "updatedby": "TGA",
        "diameter": 25,
        "secondarydiameter": null,
        "designtype": 5,
        "normalstatus": 1,
        "presentstatus": 1,
        "operable": 1,
        "installdate": 1136113200000,
        "assetid": null,
        "ownedby": 1,
        "maintby": 0,
        "symbolrotation": 224,
        "lifecyclestatus": 8,
        "bondedinsulated": null,
        "cptraceability": 0,
        "inservicedate": null,
        "retireddate": null,
        "spatialconfidence": 2,
        "cpoverride": null,
        "lifecyclestatusdate": null,
        "watertype": 1,
        "fittingtype": 6,
        "valveturnsclose": 0,
        "data_id": "",
        "valveclosedirection": 0,
        "name": null,
        "spatialsource": 2,
        "material": 0,
        "presentstatusdate": null,
        "bypass": 2,
        "notes": null,
        "article_id": "0",
        "manufacturer": 0,
        "normalstatusreason": 0,
        "critical": 0,
        "removeddate": null,
        "designlength": 0,
        "untraceable": 1,
        "hist_id": null,
        "capacity": 0,
        "residentialunits": 0,
        "keyaccount": 0,
        "nrm_id": 201959141,
        "devicefunction": 0,
        "measurementdate": 1136113200000,
        "measuredby": 0,
        "supervisor": 1,
        "contractor": 0,
        "mechanic": "N.v.t.",
        "customer": 0,
        "constructioncompany": 0,
        "breakprotection": 0,
        "protectiontype": 0,
        "deviatinggroundcover": 0,
        "devicelocation": "nvt",
        "metercapacity": 0,
        "measurementrange_pressure": 0,
        "measurementrange_temperature": 0,
        "realtime": 0,
        "lastinspectiondate": null,
        "installationtype": "nvt",
        "measurement_function": 0,
        "projectnumber": "",
        "network": 1,
        "strategicsystem": "nvt",
        "limitservicearea": 0,
        "temporarily_inoperable": 2,
        "contactperson": "nvt",
        "telephonenumber": "nvt",
        "annualusage": 0,
        "meternumber": "nvt",
        "metertype": "nvt",
        "reasonclosed": 0,
        "ordernumber": "0",
        "garnishremoved": 2,
        "risky": 0,
        "strategic": 0,
        "waterhardness": 0,
        "riskysystem": "",
        "minimumpressure": 0,
        "maximumpressure": 0,
        "municipality": "nvt",
        "residence": "nvt",
        "streetname": "nvt",
        "housenumber": "nvt",
        "postalcode": "nvt",
        "fittings": "nvt",
        "created_user": null,
        "created_date": null,
        "last_edited_user": null,
        "last_edited_date": null,
        "displayField": "Service afsluiter: 5125",
        "displayFieldComplement": "",
        "geometry": {
            "x": 199165.6700000018,
            "y": 309467.73800000176
        },
        "geometryType": "esriGeometryPoint"
    },
  	...
]
```

#### <ins>Group results by asset group</ins>
In the widget, results are listed by asset group and by priority so we need to group them and sort them by priority.

We first group them by asset group. *groupedTraceResults* variable :
```
{
	Aansluiting: [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, …],
	Aansluitleiding: [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, …],
	Brandkraan: [{…}, {…}, {…}, {…}, {…}],
	Leiding: [{…}, {…}, {…}, {…}, {…}],
	Service afsluiter: [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}],
	Systeem afsluiter: [{…}, {…}, {…}, {…}]
}
```

Then we sort them by priority :
```
const sortOrder = {
	"Systeem afsluiter": 1,
	"Aansluiting": 2,
	"Brandkraan": 3,
	"Monitoring": 4,
	"Levering": 5,
	"Netmeetpunt": 6,
	"Service afsluiter": 7,
	"Leiding": 8,
	"Aansluitleiding": 9
};
```

And inside each group, we split them into 3 other groups / arrays to have in first position kidney dialysis, then key accounts and then the rest.
```
return {
	...group,
	items: [[...kidneyDialysis], [...keyAccounts], [...normalItems]]
};
```

This is our final results. *groupedTraceResults_array* variable :
```
[
	{key: 'Systeem afsluiter', assetGroupCode: 'Systeem afsluiter', items: Array(3)}, 
	{key: 'Aansluiting', assetGroupCode: 'Aansluiting', items: Array(3)},
	{key: 'Brandkraan', assetGroupCode: 'Brandkraan', items: Array(3)},
	{key: 'Service afsluiter', assetGroupCode: 'Service afsluiter', items: Array(3)},
	{key: 'Leiding', assetGroupCode: 'Leiding', items: Array(3)},
	{key: 'Aansluitleiding', assetGroupCode: 'Aansluitleiding', items: Array(3)}
]
```

#### <ins>Draw the results on the map</ins>
Finaly, we draw the results on the map if geometry types are esriGeometryPoint or esriGeometryPolyline.

#### <ins>Export the results to an Excel file</ins>
There is a button to export the results to a file once the trace is completed. The file contains a table of the service connections found (“Aansluiting”).

This is performed by the librairy SheetJS. You need to install the package xlsx : https://www.npmjs.com/package/xlsx

If you install the xlsx package on an virtual machine with no internet connection, you will need to install manually these 9 packages :
- adler-32-1.3.1.tgz
- cfb-1.2.2.tgz
- codepage-1.15.0.tgz
- crc-32-1.2.2.tgz
- frac-1.1.2.tgz
- ssf-0.11.2.tgz
- wmf-1.0.2.tgz
- word-0.3.0.tgz
- xlsx-0.18.5.tgz

The versions may differ.

There are two functions to export the results :
-	generateResultsToExport()
-	exportToExcel()

The first one prepare the results with the aliases, the real values (and not coded values) and only the field needed.

The second one export the results prepared in the first function.

#### <ins>Zoom on results and open popup</ins>
After the trace is performed, the map will zoom to the extent of the results. There is for that a calculateResultsExtent() function.

Results in the list are also clickable. When you click on an item, it will zoom on it and will open the item popup. This is handled by the function zoomOnObject().

Actually, there is a trick with the popup. You will not see it opening. This is because in the WML application, there is an other panel displaying the item attributes. So when you click on an item in the list, the map will zoom on it and the popup will open, not on the item but at coordinates (0,0), and it will allow to view the item attributes in the other panel. But you can also always click on features on the map and this time, it will open the popup.
