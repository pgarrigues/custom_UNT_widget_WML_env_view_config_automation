import { React, AllWidgetProps, SessionManager } from 'jimu-core'
import { UserSession } from '@esri/arcgis-rest-auth'
import { JimuMapViewComponent, JimuMapView } from 'jimu-arcgis'
const { useState, useEffect } = React
import Graphic from 'esri/Graphic'
import SimpleMarkerSymbol from 'esri/symbols/SimpleMarkerSymbol'
import Point from 'esri/geometry/Point'
import Polyline from "esri/geometry/Polyline";
import Extent from "esri/geometry/Extent";
import MapView from 'esri/views/MapView';
import FeatureLayer from "esri/layers/FeatureLayer";
import esriRequest from "esri/request";
import proximityOperator from "esri/geometry/operators/proximityOperator"
import * as geometryEngine from "esri/geometry/geometryEngine";
import * as XLSX from 'xlsx';
import '../../widget.scss';

export default function CustomTraceWidget (
  props: AllWidgetProps<unknown>
) {

  interface DataItem {
    [key: string]: any;
  }

  interface AssetGroupAndTypeCombination {
    id: number;
    assetGroup: string;
    code: number;
    assetType: string;
    featureLayerUrl: string;
  }

  interface TraceLocation {
    globalId: string;
    isFilterBarrier: boolean;
    traceLocationType: "startingPoint" | "barrier";
    terminalId?: number;
    percentAlong?: number;
  }

  interface GroupedTraceResultForDisplay {
    key: string;
    assetGroupCode: string;
    items: DataItem[][];
  }
  
  const [runtimeConfig, setRuntimeConfig] = useState({
    utilityNetworkServiceUrl: '',
    utilityNetworkFeatureServerUrl: '',
    traceFindIsolatingValvesGlobalId: '',
    traceFindIsolatingValvesType: '',
    traceFindIsolatedAssetsGlobalId: '',
    traceFindIsolatedAssetsType: ''
  });
  const [assetGroupAndTypeCombinations, setAssetGroupAndTypeCombinations] = useState<AssetGroupAndTypeCombination[]>([]);
  const [activeTab, setActiveTab] = useState<'input' | 'results'>('input');
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isTraceRunning, setIsTraceRunning] = useState(false);
  const [isTraceReturnError, setIsTraceReturnError] = useState(false);
  const [traceError, setTraceError] = useState('');
  const [startingPointsCount, setStartingPointsCount] = useState(0);
  const [selectedFeatures, setSelectedFeatures] = useState<any[]>([]);
  const [selectedFeatureAssetGroupAndType, setSelectedFeatureAssetGroupAndType] = useState<string[]>([]);
  const [findIsolatingValvesTraceLocations, setFindIsolatingValvesTraceLocations] = useState<string[]>([]);
  const [findIsolatingValvesTraceResults, setFindIsolatingValvesTraceResults] = useState<DataItem[]>([]);
  const [findIsolatingValvesTraceResultsCount, setFindIsolatingValvesTraceResultsCount] = useState(0);
  const [findIsolatedAssetsTraceLocations, setFindIsolatedAssetsTraceLocations] = useState<TraceLocation[]>([]);
  const [findIsolatedAssetsTraceResults, setFindIsolatedAssetsTraceResults] = useState<DataItem[]>([]);
  const [findIsolatedAssetsTraceResultsCount, setFindIsolatedAssetsTraceResultsCount] = useState(0);
  const [uniqueTraceResults, setUniqueTraceResults] = useState<DataItem[]>([]);
  const [uniqueTraceResultsCount, setUniqueTraceResultsCount] = useState(0);
  const [uniqueTraceResultsWithAssetGroupAndTypeNames, setUniqueTraceResultsWithAssetGroupAndTypeNames] = useState<DataItem[]>([]);
  const [uniqueTraceResultsWithAllAttributes, setUniqueTraceResultsWithAllAttributes] = useState<DataItem[]>([]);
  const [groupedTraceResults, setGroupedTraceResults] = useState<Record<string, DataItem[]>>({});
  const [afsluitersCount, setAfsluitersCount] = useState(0);
  const [aansluitingenCount, setAansluitingenCount] = useState(0);
  const [groupedTraceResults_array, setGroupedTraceResults_array] = useState<GroupedTraceResultForDisplay[]>([]);
  const [resultsToExport, setResultsToExport] = useState<Record<string, any>[]>([]);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);
  const [pointSelectionPopUpOpened, setPointSelectionPopUpOpened] = useState(false);

  // Get token
  const getToken = async () => {
    const session: UserSession = await SessionManager.getInstance().getMainSession()
    if (session) {
      const token = session.token
      return token
    } else {
      console.warn("No session was found.")
      return null
    }
  }

  // Set Map View
  const onActiveViewChange = (jimuMapView: JimuMapView) => {
    if (jimuMapView && jimuMapView.view) {
      setMapView(jimuMapView.view as MapView)
    }
  }

  const getFeatureServerRootFromLayerUrl = (url?: string): string | null => {
    if (!url) return null;

    const match = url.match(/^(.*\/FeatureServer)(?:\/\d+)?\/?$/i);

    return match ? match[1] : null;
  };

  const getUtilityNetworkServerUrlFromFeatureServerRoot = (featureServerRootUrl: string): string => {
    return featureServerRootUrl.replace(/\/FeatureServer\/?$/i, '/UtilityNetworkServer');
  };

  const isValidUtilityNetworkServerUrl = async (
    utilityNetworkServerUrl: string,
    token: string
  ): Promise<boolean> => {
    try {
      const response = await esriRequest(utilityNetworkServerUrl, {
        query: {
          f: 'json',
          token
        },
        responseType: 'json'
      });

      if (response.data?.error) {
        console.warn(
          'Utility Network Server candidate returned an error:',
          utilityNetworkServerUrl,
          response.data.error
        );
        return false;
      }

      console.log('Valid Utility Network Server found:', utilityNetworkServerUrl, response.data);

      return true;
    } catch (error) {
      console.warn('Not a valid Utility Network Server:', utilityNetworkServerUrl, error);
      return false;
    }
  };

  const getUtilityNetworkServiceUrlFromWebMap = async (
    token: string
  ): Promise<string | null> => {
    if (!mapView) return null;

    await mapView.when();
    await mapView.map.loadAll();

    const mapAny = mapView.map as any;

    /**
     * Attempt 1:
     * Try to read Utility Networks directly from the WebMap.
     */
    try {
      const utilityNetworks = mapAny.utilityNetworks;

      console.log('map.utilityNetworks', utilityNetworks);

      if (utilityNetworks && utilityNetworks.length > 0) {
        const utilityNetwork = utilityNetworks.getItemAt
          ? utilityNetworks.getItemAt(0)
          : utilityNetworks[0];

        if (utilityNetwork?.load) {
          await utilityNetwork.load();
        }

        if (utilityNetwork?.url) {
          console.log('Utility Network URL found from map.utilityNetworks:', utilityNetwork.url);
          return utilityNetwork.url;
        }
      }
    } catch (error) {
      console.warn('Could not read map.utilityNetworks:', error);
    }

    /**
     * Attempt 2:
     * Fallback: scan all map layers, find FeatureServer roots,
     * derive UtilityNetworkServer URLs, and test them.
     */
    const candidateFeatureServerRoots = new Set<string>();

    const allLayers = mapAny.allLayers?.toArray
      ? mapAny.allLayers.toArray()
      : mapView.map.layers.toArray();

    console.log('allLayers from map', allLayers);

    for (const layer of allLayers) {
      const root = getFeatureServerRootFromLayerUrl(layer.url);

      if (root) {
        candidateFeatureServerRoots.add(root);
      }

      /**
       * Some layers may have sublayers.
       */
      const sublayers = layer.allSublayers?.toArray
        ? layer.allSublayers.toArray()
        : [];

      for (const sublayer of sublayers) {
        const sublayerRoot = getFeatureServerRootFromLayerUrl(sublayer.url);

        if (sublayerRoot) {
          candidateFeatureServerRoots.add(sublayerRoot);
        }
      }
    }

    console.log(
      'candidateFeatureServerRoots',
      Array.from(candidateFeatureServerRoots)
    );

    for (const featureServerRoot of candidateFeatureServerRoots) {
      const utilityNetworkServerUrl =
        getUtilityNetworkServerUrlFromFeatureServerRoot(featureServerRoot);

      const isValid = await isValidUtilityNetworkServerUrl(
        utilityNetworkServerUrl,
        token
      );

      if (isValid) {
        return utilityNetworkServerUrl;
      }
    }

    console.warn('No Utility Network service found in the connected web map.');

    return null;
  };

  const getFeatureServerUrlFromUtilityNetworkUrl = (utilityNetworkUrl: string) => {
    return utilityNetworkUrl.replace(/\/UtilityNetworkServer\/?$/i, '/FeatureServer');
  };

  const queryNamedTraceConfigurations = async (
    utilityNetworkServiceUrl: string,
    token: string
  ): Promise<any[]> => {
    const url = `${utilityNetworkServiceUrl}/traceConfigurations/query`;

    const response = await esriRequest(url, {
      query: {
        f: 'json',
        token
      },
      method: 'post',
      responseType: 'json'
    });

    const data = response.data;

    return (
      data.traceConfigurations ??
      data.namedTraceConfigurations ??
      data.configurations ??
      []
    );
  };

  const findTraceConfigurationByName = (
    traceConfigurations: any[],
    traceConfigurationName: string
  ) => {
    return traceConfigurations.find(config =>
      config.name === traceConfigurationName ||
      config.traceConfigurationName === traceConfigurationName
    );
  };

  const getTraceConfigurationGlobalId = (traceConfiguration: any) => {
    return (
      traceConfiguration.globalId ??
      traceConfiguration.globalID ??
      traceConfiguration.globalid ??
      traceConfiguration.id
    );
  };

  const getTraceConfigurationType = (
    traceConfiguration: any,
    fallbackType: string
  ) => {
    return (
      traceConfiguration.traceType ??
      traceConfiguration.type ??
      fallbackType
    );
  };

  const initializeRuntimeConfigFromWebMap = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const utilityNetworkServiceUrl =
        await getUtilityNetworkServiceUrlFromWebMap(token);

      if (!utilityNetworkServiceUrl) {
        throw new Error("No Utility Network service found in the connected web map.");
      }

      const utilityNetworkFeatureServerUrl =
        getFeatureServerUrlFromUtilityNetworkUrl(utilityNetworkServiceUrl);

      const traceConfigurations =
        await queryNamedTraceConfigurations(
          utilityNetworkServiceUrl,
          token
        );

      console.log("traceConfigurations", traceConfigurations);

      const findIsolatingValvesTraceConfig =
        findTraceConfigurationByName(
          traceConfigurations,
          "VindIsolerendeAfsluiters"
        );

      const findIsolatedAssetsTraceConfig =
        findTraceConfigurationByName(
          traceConfigurations,
          "VindGeisoleerdeAssets"
        );

      if (!findIsolatingValvesTraceConfig) {
        throw new Error("Trace configuration 'VindIsolerendeAfsluiters' was not found.");
      }

      if (!findIsolatedAssetsTraceConfig) {
        throw new Error("Trace configuration 'VindGeisoleerdeAssets' was not found.");
      }

      const traceFindIsolatingValvesGlobalId =
        getTraceConfigurationGlobalId(findIsolatingValvesTraceConfig);

      const traceFindIsolatedAssetsGlobalId =
        getTraceConfigurationGlobalId(findIsolatedAssetsTraceConfig);

      const traceFindIsolatingValvesType =
        getTraceConfigurationType(findIsolatingValvesTraceConfig, "isolation");

      const traceFindIsolatedAssetsType =
        getTraceConfigurationType(findIsolatedAssetsTraceConfig, "connected");

      const detectedConfig = {
        utilityNetworkServiceUrl,
        utilityNetworkFeatureServerUrl,
        traceFindIsolatingValvesGlobalId,
        traceFindIsolatingValvesType,
        traceFindIsolatedAssetsGlobalId,
        traceFindIsolatedAssetsType
      };

      console.log("Detected runtime config from web map", detectedConfig);

      setRuntimeConfig(detectedConfig);
    } catch (error) {
      console.error("Failed to initialize widget config from web map", error);
      setIsTraceReturnError(true);
      setTraceError(error.message);
    }
  };

  useEffect(() => {
    if (!mapView) return;

    initializeRuntimeConfigFromWebMap();
  }, [mapView]);

  // Get all asset groups and types combinations
  const getAssetGroupAndTypeCombinations = (utilityNetworkFeatureServerUrl: string) => {
    const layersUrls: string[] = [];
    
    esriRequest(utilityNetworkFeatureServerUrl, {
      query: {
        f: "json"
      }
    }).then((response) => {
      const layers = response.data.layers;
      layers.forEach((layer) => {
        const layerUrl = utilityNetworkFeatureServerUrl + "/" + layer.id;
        layersUrls.push(layerUrl);
      });
    }).then(() => {
      for (let i=0; i<layersUrls.length; i++){
        const queryFeatureLayer = async () => {
          const token = await getToken()
          if (!token) return
          
          const url = layersUrls[i];
          
          esriRequest(url, {
            query: {
              f: "json",
              token: token
            }
          }).then(response => {
            const layerInfo = response.data;

            // Access types and domains
            const layer_types = layerInfo.types

            try {
              if (layer_types !== undefined) {
                for (let j=0; j<layer_types.length; j++){
                  for (let k=0; k<layer_types[j].domains.ASSETTYPE.codedValues.length; k++){
                    const assetGroupAndType = new Object({ 
                      id: layer_types[j].id,
                      assetGroup: layer_types[j].name, 
                      code: layer_types[j].domains.ASSETTYPE.codedValues[k].code,
                      assetType: layer_types[j].domains.ASSETTYPE.codedValues[k].name,
                      featureLayerUrl: response.url
                    });
                    setAssetGroupAndTypeCombinations((prev) => [...prev, assetGroupAndType])
                  }
                }
              }
            } catch (error) {
              console.warn(error);
            }
          });
        };
        queryFeatureLayer();
      }
    });
  }

  useEffect(() => {
    if (!runtimeConfig.utilityNetworkFeatureServerUrl) return;
    setAssetGroupAndTypeCombinations([]);
    getAssetGroupAndTypeCombinations(runtimeConfig.utilityNetworkFeatureServerUrl);
  }, [runtimeConfig.utilityNetworkFeatureServerUrl]);

  // Popups management
  useEffect(() => {
    if (mapView){
      if (isSelectionMode === false){
        mapView.popupEnabled = true;
      }
      else{
        mapView.popupEnabled = false;
      }
    }
  }, [mapView, isSelectionMode])

  // Starting points count update
  useEffect(() => {
    setStartingPointsCount(findIsolatingValvesTraceLocations.length)
  }, [findIsolatingValvesTraceLocations])

  // Activate selection
  const activatePointSelection = () => {
    if(pointSelectionPopUpOpened === false){
      setPointSelectionPopUpOpened(true);
      setTimeout(() => {
        setPointSelectionPopUpOpened(false);
      }, 3000);
    } else {
      setPointSelectionPopUpOpened(false);
    }

    if (isSelectionMode === false){
      setIsSelectionMode(true);
      mapView.cursor = 'crosshair';
    }
    else {
      setIsSelectionMode(false);
      mapView.cursor = 'default';
    }
  }

  // Points selection
  useEffect(() => {
    if (!mapView) return;
    
    let intersectedFeatures = [];

    const handler = mapView.on("click", (event) => {
      if (!isSelectionMode) return;
      
      const { x, y } = event.mapPoint;
      const point = new Point({
        x: x, 
        y: y,
        spatialReference: mapView.spatialReference
      });

      // Check if the point intersects each layer or not
      mapView.map.layers.forEach(async (layer) => {
        if(layer.queryFeatures && ((layer.title !== 'Water Subnetwork') && (layer.title !== 'Water Subnetwerk') && (layer.title !== 'Subnetwerk'))){
          try {
            const results = await layer.queryFeatures({
              geometry: point,
              spatialRelationship: "intersects",
              distance: 0.2,
              units: "meters",
              outFields: ["*"],
              returnGeometry: true
            });
            
            if(results.features.length > 0){
              // For each object intersected
              for (let i=0; i<results.features.length; i++){
                // We want the layer and sublayer to be visible. Otherwise we do not select the object.
                if(layer.visible === true && results.features[i].layer.visible === true){
                  if(results.features[i].geometry.type !== 'point'){
                    let data = results.features[i].attributes.GLOBALID + " - " + results.features[i].attributes.Shape__Length + " - " + results.features[i].geometry.type
                    
                    let polyline = new Polyline({
                      paths: results.features[i].geometry.paths,
                      spatialReference: mapView.spatialReference
                    });
                    
                    // We are looking for the closest point on the line from our point
                    const proximityResult = proximityOperator.getNearestCoordinate(polyline, point);
                    let new_x = proximityResult.coordinate.x
                    let new_y = proximityResult.coordinate.y

                    const new_point = new Point({
                      x: new_x, 
                      y: new_y,
                      spatialReference: mapView.spatialReference
                    });

                    // Function to calculate distance along the line from the first vertex to the point
                    function getDistanceAlongLine(polyline, point) {
                      let totalLength = 0;
                      const paths = polyline.paths;

                      for (let i = 0; i < paths.length; i++) {
                        const path = paths[i];

                        for (let j = 0; j < path.length - 1; j++) {
                          const startPoint = new Point({ x: path[j][0], y: path[j][1], spatialReference: polyline.spatialReference });
                          const endPoint = new Point({ x: path[j + 1][0], y: path[j + 1][1], spatialReference: polyline.spatialReference });

                          // Create segment
                          const segment = new Polyline({
                            paths: [[
                              [startPoint.x, startPoint.y],
                              [endPoint.x, endPoint.y]
                            ]],
                            spatialReference: polyline.spatialReference
                          });

                          const segment_start_point = new Point({
                            x: startPoint.x,
                            y: startPoint.y,
                            spatialReference: mapView.spatialReference
                          });

                          const segment_end_point = new Point({
                            x: endPoint.x,
                            y: endPoint.y,
                            spatialReference: mapView.spatialReference
                          });

                          const distanceMeters = geometryEngine.distance(segment_start_point, segment_end_point, "meters", {
                            geodesic: true
                          });

                          // Check if point lies on this segment
                          if (geometryEngine.touches(point, segment) || geometryEngine.contains(segment, point)) {
                            // Partial distance from start of segment to point
                            const partialDistance = geometryEngine.distance(point, startPoint);
                            
                            return totalLength + partialDistance;
                          }

                          // Add full segment length to total
                          totalLength += distanceMeters;
                        }
                      }

                      // If point not found on any segment
                      return null;
                    }

                    const distance = getDistanceAlongLine(polyline, new_point);

                    if (distance !== null) {
                      let percentAlong = distance/results.features[i].attributes.Shape__Length
                      intersectedFeatures.push(data);
                      let traceLocation = '{"globalId":"'+results.features[i].attributes.GLOBALID+'","isFilterBarrier":false,"percentAlong":'+percentAlong+',"traceLocationType":"startingPoint"}'
                      setFindIsolatingValvesTraceLocations((prev) => [...prev, traceLocation]);
                      const match = assetGroupAndTypeCombinations.find(item => item.id === results.features[i].attributes.ASSETGROUP && item.code === results.features[i].attributes.ASSETTYPE);
                      setSelectedFeatureAssetGroupAndType((prev) => [...prev, match.assetGroup +' - '+match.assetType])
                      
                    }
                  }
                  else {
                    let data = results.features[i].attributes.GLOBALID + " - " + results.features[i].geometry.type
                    intersectedFeatures.push(data);
                    let traceLocation = '{"globalId":"'+results.features[i].attributes.GLOBALID+'","isFilterBarrier":false,"terminalId":1,"traceLocationType":"startingPoint"}'
                    setFindIsolatingValvesTraceLocations((prev) => [...prev, traceLocation]);
                    const match = assetGroupAndTypeCombinations.find(item => item.id === results.features[i].attributes.ASSETGROUP && item.code === results.features[i].attributes.ASSETTYPE);
                    setSelectedFeatureAssetGroupAndType((prev) => [...prev, match.assetGroup +' - '+match.assetType])
                  }

                  setSelectedFeatures((prev) => [...prev, intersectedFeatures]);

                  const markerSymbol = new SimpleMarkerSymbol({
                    style: 'circle',
                    color: [0, 164, 0, 1],
                    size: 15,
                    outline: {
                      color: [255, 255, 255, 1],
                      width: 2
                    }
                  });

                  const pointGraphic = new Graphic({
                    geometry: point,
                    symbol: markerSymbol
                  });

                  mapView.graphics.add(pointGraphic);
                              
                  setIsSelectionMode(false);
                  mapView.cursor = 'default';
                }
              }
            }
          } catch (err) {
            console.error("Error querying layer:", layer.title, err);
          }
        }
      })
    });

    return () => handler.remove()
  }, [mapView, isSelectionMode]);


  // Run trace
  const runTrace = async () => { 
    const controller = new AbortController();
    setAbortController(controller);
    setIsTraceRunning(true);
    setIsTraceReturnError(false);

    const token = await getToken()
    if (!token) {
      setIsTraceRunning(false);
      return;
    }

    if (
      !runtimeConfig.utilityNetworkServiceUrl ||
      !runtimeConfig.traceFindIsolatingValvesGlobalId ||
      !runtimeConfig.traceFindIsolatedAssetsGlobalId
    ) {
      setIsTraceRunning(false);
      setIsTraceReturnError(true);
      setTraceError("Widget configuration could not be read from the connected web map.");
      return;
    }
    
    const traceUrl = `${runtimeConfig.utilityNetworkServiceUrl}/trace`

    try {
      const traceParamsFindIsolatingValves = {
        traceConfigurationGlobalId: runtimeConfig.traceFindIsolatingValvesGlobalId,
        traceLocations: '['+findIsolatingValvesTraceLocations+']',
        traceType: runtimeConfig.traceFindIsolatingValvesType,
        f: 'json'
      }
      
      const responseFindIsolatingValves = await esriRequest(traceUrl, {
        query: {
          ...traceParamsFindIsolatingValves,
          token: token
        },
        method: "post",
        body: traceParamsFindIsolatingValves,
        responseType: "json",
        signal: controller.signal, // cancel request
        timeout: 120000 // milliseconds
      });

      const traceFindIsolatingValvesResultElements = responseFindIsolatingValves.data?.traceResults?.elements ?? [];
      setFindIsolatingValvesTraceResults(traceFindIsolatingValvesResultElements)
      setFindIsolatingValvesTraceResultsCount(traceFindIsolatingValvesResultElements.length)

      // Convert start points from string JSON to objects
      const startingPointLocations = findIsolatingValvesTraceLocations.map(location =>
        typeof location === 'string' ? JSON.parse(location) : location
      );

      // Convert results from 1st trace to barriers
      const barrierLocations = traceFindIsolatingValvesResultElements.map(item => ({
        globalId: item.globalId,
        isFilterBarrier: false,
        terminalId: 1,
        traceLocationType: "barrier"
      }));

      // Combine start points + barriers
      const newFindIsolatedAssetsTraceLocations = [
        ...startingPointLocations,
        ...barrierLocations
      ];

      // Update state
      setFindIsolatedAssetsTraceLocations(newFindIsolatedAssetsTraceLocations);

      const traceParamsFindIsolatedAssets = {
        traceConfigurationGlobalId: runtimeConfig.traceFindIsolatedAssetsGlobalId,
        traceLocations: JSON.stringify(newFindIsolatedAssetsTraceLocations),
        traceType: runtimeConfig.traceFindIsolatedAssetsType,
        f: 'json'
      }

      const responseFindIsolatedAssets = await esriRequest(traceUrl, {
        query: {
          ...traceParamsFindIsolatedAssets,
          token: token
        },
        method: "post",
        body: traceParamsFindIsolatedAssets,
        responseType: "json",
        signal: controller.signal, // cancel request
        timeout: 120000 // milliseconds
      });

      const traceFindIsolatedAssetsResultElements = responseFindIsolatedAssets.data?.traceResults?.elements ?? [];
      setFindIsolatedAssetsTraceResults(traceFindIsolatedAssetsResultElements)
      setFindIsolatedAssetsTraceResultsCount(traceFindIsolatedAssetsResultElements.length)

      // Enrich isolating valves from 1st trace
      const isolatingValvesWithAllAttributes = await enrichTraceResults(traceFindIsolatingValvesResultElements, controller.signal);
      // Enrich isolated assets
      const isolatedAssetsWithAllAttributes = await enrichTraceResults(traceFindIsolatedAssetsResultElements, controller.signal);

      if(isolatedAssetsWithAllAttributes.length !== 0 || isolatingValvesWithAllAttributes.length !== 0){
        const grouped = groupByAssetGroup(isolatedAssetsWithAllAttributes, 'assetGroup');

        // Replace "Systeem afsluiter" group by isolating valves only
        const groupedWithOnlyIsolatingValves = {
          ...grouped,
          ['Systeem afsluiter']: isolatingValvesWithAllAttributes
        };
        
        // Recreate flat list for final results
        const finalResultsWithAllAttributes = Object.values(groupedWithOnlyIsolatingValves)
          .flat() as DataItem[];
        
        setGroupedTraceResults(groupedWithOnlyIsolatingValves);
        setUniqueTraceResultsWithAllAttributes(finalResultsWithAllAttributes);
        setUniqueTraceResultsCount(finalResultsWithAllAttributes.length);
        setAfsluitersCount(traceFindIsolatingValvesResultElements.length);
        setAansluitingenCount(groupedWithOnlyIsolatingValves['Aansluiting']?.length ?? 0)
        transformObjectIntoArrayWithReadableKeys(groupedWithOnlyIsolatingValves);
        if (groupedWithOnlyIsolatingValves["Aansluiting"]?.length > 0) {
          await generateResultsToExport(groupedWithOnlyIsolatingValves);
        } else {
          setResultsToExport([]);
        }
        calculateResultsExtent(finalResultsWithAllAttributes);

        // Filter for map highlight
        const isolatedLeidingenWithAllAttributes = isolatedAssetsWithAllAttributes.filter(
          item => item.assetGroup === "Leiding"
        );
        const resultsToHighlightOnMap = [
          ...isolatingValvesWithAllAttributes,
          ...isolatedLeidingenWithAllAttributes
        ];
        drawResultsOnMap(resultsToHighlightOnMap);
      }

      // Only switch tab if not canceled
      if (!controller.signal.aborted) {
        setActiveTab('results');
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Trace canceled by user.");
      } else {
        console.error("Trace failed:", error);
        setIsTraceRunning(false);
        setIsTraceReturnError(true);
        setTraceError(error.message);
      }
    } finally {
      setIsTraceRunning(false);
      setAbortController(null); // clear ref
    }
  }

  const handleCancelTrace = () => {
    if (abortController) {
      abortController.abort();
      console.log("Trace operation canceled by user.");
    }
  };

  // Remove duplicates from results
  const removeDuplicatesByMultipleAttrsFromTraceResults = (
    dataArray: DataItem[],
    attributeKeys: string[]
  ): DataItem[] => {
    const seen = new Set();
    const uniqueData: DataItem[] = [];

    for (const item of dataArray) {
      const key = attributeKeys.map(attr => item[attr]).join('|');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(item);
      }
    }
    setUniqueTraceResults(uniqueData)
    setUniqueTraceResultsCount(uniqueData.length)

    return uniqueData;
  }

  // Add asset group and asset type names (+ feature laye url) to results
  const addAssetGroupAndTypeNamesToResults = (
    uniqueTraceResults: DataItem[],
    assetGroupAndTypeCombinations: DataItem[]
  ): DataItem[] => {
    const uniqueDataWithGroupAndTypeNames: DataItem[] = [];
    
    uniqueTraceResults.map(item2 => {  
      // Find matching item in array1 by id and code
      const match = assetGroupAndTypeCombinations.find(item1 => item1.id === item2.assetGroupCode && item1.code === item2.assetTypeCode);
      // If found, return combined object; else, return null or skip
      if (match) {
        const new_result = new Object({
          ...item2,
          assetGroup: match.assetGroup,
          assetType: match.assetType,
          featureLayerUrl: match.featureLayerUrl
        });
        uniqueDataWithGroupAndTypeNames.push(new_result);
      }
    })
    setUniqueTraceResultsWithAssetGroupAndTypeNames(uniqueDataWithGroupAndTypeNames)
    
    return uniqueDataWithGroupAndTypeNames
  }

  // Get more infos on objets
  const getResultsAllAttributes = async (
    uniqueTraceResultsWithAssetGroupAndTypeNames: DataItem[],
    signal: AbortSignal
  ): Promise<DataItem[]> => {
    // --- Step 1: Group by featureLayerUrl ---
    const groupedByFeatureLayer = uniqueTraceResultsWithAssetGroupAndTypeNames.reduce<
      Record<string, DataItem[]>
    >((acc, item) => {
      const url = item.featureLayerUrl;
      if (!acc[url]) acc[url] = [];
      acc[url].push(item);
      return acc;
    }, {});

    const batchSize = 100; // Max number of globalIds per request
    const finalResults: DataItem[] = [];

    // --- Step 2: Process each feature layer separately ---
    for (const featureLayerUrl of Object.keys(groupedByFeatureLayer)) {
      const items = groupedByFeatureLayer[featureLayerUrl];
      
      // Split into batches of 100 globalIds
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        try {
          if (signal.aborted) {
            console.log("Processing canceled at element", i);
            setFindIsolatingValvesTraceResults([]);
            setFindIsolatingValvesTraceResultsCount(0);
            setFindIsolatedAssetsTraceResults([]);
            setFindIsolatedAssetsTraceResultsCount(0);
            setUniqueTraceResults([]);
            setUniqueTraceResultsCount(0);
            setUniqueTraceResultsWithAssetGroupAndTypeNames([]);
            setAfsluitersCount(0);
            setAansluitingenCount(0);
            return [];
          }
          const token = await getToken();
          if (!token) continue;

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
            responseType: "json",
            signal
          });

          const createDisplayField = (attributes, matchedItem, assetGroup) => {
            switch (assetGroup) {
              case "Systeem afsluiter":
                return `Afsluiter ${attributes.assetid}`;
              case "Aansluiting":
                return `${attributes.streetname} ${attributes.housenumber}, ${attributes.residence}`;
              case "Monitoring":
                return `Druksensor ${attributes.name}`;
              case "Levering":
                return `${matchedItem.assetType}: ${attributes.name}`;
              case "Netmeetpunt":
                return `Netmeetpunt: ${attributes.name}`;
              default:
                return "";
            }
          };

          const createDisplayFieldComplement = (attributes) => {
            if(attributes.keyaccount > 1){
              return "(Key Account)"
            }
            else{
              return ""
            }
          }

          const features = response?.data?.features || [];

          // Map attributes back to original items
          features.forEach((feature: any) => {
            const attributes = feature.attributes;
            const matchedItem = items.find(item => item.globalId === attributes.GLOBALID);
            
            if (matchedItem) {
              const displayField = createDisplayField(attributes, matchedItem, matchedItem.assetGroup);
              const displayFieldComplement = createDisplayFieldComplement(attributes);

              finalResults.push({
                ...matchedItem,
                ...attributes,
                displayField,
                displayFieldComplement,
                geometry: feature.geometry,
                geometryType: response.data.geometryType
              });
            }
          });
        } catch (error) {
          console.error(`Error fetching data for ${featureLayerUrl}`, error);
        }
      }
    }

    // Update state with fully resolved data
    setUniqueTraceResultsWithAllAttributes(finalResults);

    return finalResults;
  };
  
  const enrichTraceResults = async (
    traceElements: DataItem[],
    signal: AbortSignal
  ): Promise<DataItem[]> => {
    const uniqueData = removeDuplicatesByMultipleAttrsFromTraceResults(
      traceElements,
      ['globalId', 'objectId', 'assetGroupCode', 'assetTypeCode']
    );

    const uniqueDataWithAssetGroupAndTypeNames =
      addAssetGroupAndTypeNamesToResults(
        uniqueData,
        assetGroupAndTypeCombinations
      );

    const uniqueDataWithAllAttributes =
      await getResultsAllAttributes(
        uniqueDataWithAssetGroupAndTypeNames,
        signal
      );

    return uniqueDataWithAllAttributes;
  };

  const calculateResultsExtent = (data) => {
    if (!mapView) return;

    let Xs = [];
    let Ys = [];

    for (const item of data){
      if(item.geometryType === "esriGeometryPoint"){
        Xs.push(item.geometry.x);
        Ys.push(item.geometry.y);
      }
      else if(item.geometryType === "esriGeometryPolyline"){
        for (const coords of item.geometry.paths){
          Xs.push(coords[0][0]);
          Ys.push(coords[0][1]);
          Xs.push(coords.slice(-1)[0][0]);
          Ys.push(coords.slice(-1)[0][1]);
        }
      }
    }

    const extent = new Extent({
      xmin: Math.min(...Xs)-10,
      ymin: Math.min(...Ys)-10,
      xmax: Math.max(...Xs)+10,
      ymax: Math.max(...Ys)+10,
      spatialReference: mapView.spatialReference
    });

    // Zoom to extent
    mapView.goTo(extent, {
      duration: 800
    });
  }

  // Group results by assetGroupCode
  const groupByAssetGroup = (array, key) => {
    return array.reduce((acc, obj) => {
      
      const groupKey = obj[key];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(obj);
      return acc;
    }, {});
  }

  // Display results
  const transformObjectIntoArrayWithReadableKeys = (data) => {
    const ASSET_GROUPS_TO_DISPLAY = [
      "Systeem afsluiter",
      "Aansluiting",
      "Monitoring",
      "Levering",
      "Netmeetpunt"
    ];

    const groupedList = Object.entries(data)
    .filter(([key]) => ASSET_GROUPS_TO_DISPLAY.includes(key))
    .map(([key, items]) => {
      const assetGroupCode = key
      return { key, assetGroupCode, items };
    });

    const sortOrder = {
      "Systeem afsluiter": 1,
      "Aansluiting": 2,
      "Monitoring": 3,
      "Levering": 4,
      "Netmeetpunt": 5
    };

    // Sort the data
    const sortedData = [...groupedList].sort((a, b) => {
      return (sortOrder[a.assetGroupCode] || Infinity) - (sortOrder[b.assetGroupCode] || Infinity);
    });

    const processedData = sortedData.map(group => {
      // Helper function to sort by displayField
      const sortByDisplayField = (a, b) =>
        a.displayField.localeCompare(b.displayField);

      // Split items into 2 groups
      const keyAccounts = group.items
        .filter(item => item.keyaccount > 1)
        .sort(sortByDisplayField);

      const normalItems = group.items
        .filter(item => !(item.keyaccount > 1))
        .sort(sortByDisplayField);

      // Combine: important first, then sorted normal items
      return {
        ...group,
        items: [[...keyAccounts], [...normalItems]]
      };
    });

    setGroupedTraceResults_array(processedData)

    return processedData
  }

  const generateResultsToExport = async (data) => {
    const aansluitingen = data["Aansluiting"];

    if (!Array.isArray(aansluitingen) || aansluitingen.length === 0) {
      console.warn("No Aansluiting results found. Excel export will be empty.");
      setResultsToExport([]);
      return [];
    }

    let dataAansluitingFeatureUrl = [];
    
    for (const item of aansluitingen){
      dataAansluitingFeatureUrl.push(item.featureLayerUrl)
    }

    dataAansluitingFeatureUrl = [... new Set(dataAansluitingFeatureUrl)][0];

    if (!dataAansluitingFeatureUrl) {
      console.warn("No Aansluiting feature layer URL found. Excel export will be empty.");
      setResultsToExport([]);
      return [];
    }

    // Get fields, aliases, domains etc
    const response = await esriRequest(`${dataAansluitingFeatureUrl}?f=json`);
    const fields = response.data.fields;
    
    let aliases = fields.reduce((acc, field) => {
      acc[field.name.toLowerCase()] = field.alias || field.name;
        return acc;
    }, {} as Record<string, string>);
    
    // global domains
    const domains = {};
    for (const field of fields){
      if(field.domain !== null){
        domains[field.name] = field.domain.codedValues;
      }
    }

    // aansluiting domains
    const subtypes = response.data.subtypes;
    const aansluitingSubtype = subtypes.find(obj => obj.name === 'Aansluiting');
    const aansluitingDomains = aansluitingSubtype.domains
    
    const aansluitingDesignTypeDomains = [];
    if(aansluitingDomains.designtype.codedValues !== undefined) {
      aansluitingDesignTypeDomains.push(aansluitingDomains.designtype.codedValues);
    } else {
      aansluitingDesignTypeDomains.push(domains.designtype);
    }
    
    const aansluitingKeyAccountDomains = [];
    if(aansluitingDomains.keyaccount.codedValues !== undefined) {
      aansluitingKeyAccountDomains.push(aansluitingDomains.keyaccount.codedValues);
    } else {
      aansluitingKeyAccountDomains.push(domains.keyaccount);
    }

    const aansluitingLifeCycleStatusDomains = [];
    if(aansluitingDomains.lifecyclestatus.codedValues !== undefined) {
      aansluitingLifeCycleStatusDomains.push(aansluitingDomains.lifecyclestatus.codedValues);
    } else {
      aansluitingLifeCycleStatusDomains.push(domains.lifecyclestatus);
    }

    const domainsForExport = {
      designtype: aansluitingDesignTypeDomains[0],
      keyaccount: aansluitingKeyAccountDomains[0],
      lifecyclestatus: aansluitingLifeCycleStatusDomains[0]
    }

    const fieldsToKeep = [
      'assetType',
      'assetid',
      'lifecyclestatus',
      'designtype',
      'keyaccount',
      'contactperson',
      'telephonenumber',
      'annualusage',
      'SystemSubnetworkName',
      'PressureSubnetworkName',
      'minimumpressure',
      'maximumpressure',
      'waterhardness',
      'name',
      'metertype',
      'municipality',
      'residence',
      'streetname',
      'housenumber',
      'postalcode'
    ];

    const filteredResultsToExport = aansluitingen.map(item => {
      const filteredItem: Record<string, any> = {};
      fieldsToKeep.forEach(field => {
        filteredItem[field.toLowerCase()] = item[field];
      });
      return filteredItem;
    });

    const domainLookup = Object.fromEntries(
      Object.entries(domainsForExport).map(([k, v]) => [
        k,
        Object.fromEntries(v.map((cv: any) => [cv.code, cv.name]))
      ])
    );

    // replace coded values by real values
    const decodedFeatures = filteredResultsToExport.map(f =>
      Object.fromEntries(
        Object.entries(f).map(([k, v]) => [
          k,
          domainLookup[k]?.[v] ?? v  // decode if possible, else keep original
        ])
      )
    );

    // replace name attributes by aliases
    const finalResults = decodedFeatures.map(f =>
      Object.fromEntries(
        Object.entries(f).map(([k, v]) => [aliases[k] ?? k, v])
      )
    );
    
    setResultsToExport(finalResults);

    return finalResults
  }

  // Draw results on map
  const drawResultsOnMap = (resultsToHighlight) => {
    if (!mapView) return;

    const HIGHLIGHT_COLOR = [0, 255, 0, 0.75];
    const ISOLATING_VALVE_ASSET_GROUP = "Systeem afsluiter";
    const MAIN_WATER_PIPE_ASSET_GROUP = "Leiding";

    for (const result of resultsToHighlight){
      const isIsolatingValve =
        result.assetGroup === ISOLATING_VALVE_ASSET_GROUP;
      
      const isMainWaterPipe =
        result.assetGroup === MAIN_WATER_PIPE_ASSET_GROUP;

      if (!isIsolatingValve && !isMainWaterPipe) {
        continue;
      }

      if (!result.geometry || !result.geometryType) {
        console.warn("Missing geometry for highlighted result:", result);
        continue;
      }
      
      if (isIsolatingValve && result.geometryType === "esriGeometryPoint") {
        const point = new Point({
          x: result.geometry.x,
          y: result.geometry.y,
          spatialReference: mapView.spatialReference
        });

        const markerSymbol = new SimpleMarkerSymbol({
          style: "circle",
          color: HIGHLIGHT_COLOR,
          size: 24,
          outline: {
            color: [255, 255, 255, 1],
            width: 3
          }
        });

        const pointGraphic = new Graphic({
          geometry: point,
          symbol: markerSymbol
        });

        mapView.graphics.add(pointGraphic);
      }
      else if (isMainWaterPipe && result.geometryType === "esriGeometryPolyline") {
        const polylineGraphic = new Graphic({
          geometry: {
            type: "polyline",
            paths: result.geometry.paths,
            spatialReference: mapView.spatialReference
          },
          symbol: {
            type: "simple-line",
            color: HIGHLIGHT_COLOR,
            width: 4,
            cap: "round",
            join: "round"
          }
        });

        mapView.graphics.add(polylineGraphic);
      }
    }
  };

  const exportToExcel = (data: any[]) => {
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    function formatDateInParisTime(timestamp: number | null | undefined): string {
      if (timestamp == null) return 'N/A';

      const date = new Date(timestamp);

      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Paris'
      };

      const parts = new Intl.DateTimeFormat('fr-FR', options).formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value || '0000';
      const month = parts.find(p => p.type === 'month')?.value || '00';
      const day = parts.find(p => p.type === 'day')?.value || '00';
      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';

      return `${year}${month}${day}_${hour}${minute}`;
    }

    let date_time = formatDateInParisTime(Date.now());
    const fileName = `Resultaten_lekanalyse_${date_time}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const clearAllResults = () => {
    mapView.graphics.removeAll();
    setActiveTab('input');
    setStartingPointsCount(0);
    setSelectedFeatures([]);
    setSelectedFeatureAssetGroupAndType([]);
    setFindIsolatingValvesTraceLocations([]);
    setFindIsolatingValvesTraceResults([]);
    setFindIsolatingValvesTraceResultsCount(0);
    setFindIsolatedAssetsTraceLocations([]);
    setFindIsolatedAssetsTraceResults([]);
    setFindIsolatedAssetsTraceResultsCount(0);
    setUniqueTraceResults([]);
    setUniqueTraceResultsCount(0);
    setUniqueTraceResultsWithAssetGroupAndTypeNames([]);
    setUniqueTraceResultsWithAllAttributes([]);
    setGroupedTraceResults({});
    setAfsluitersCount(0);
    setAansluitingenCount(0);
    setGroupedTraceResults_array([]);
    setResultsToExport([]);
    setIsTraceReturnError(false);
    setTraceError('');
  }

  const zoomOnObject = async (item: any) => {
    const token = await getToken();
    if (!token) return;
    if (!mapView) return;
    
    let mapLayers = [];
    for (const layer of mapView.map.layers.items){
      let layerUrl = layer.url+"/"+layer.layerId
      mapLayers.push(layerUrl)
    }

    if (mapLayers.includes(item.featureLayerUrl)) { 
      const whereClause = `globalId IN (${`'${item.globalId}'`})`; 
      const url = `${item.featureLayerUrl}/query`;

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

      if (response.data.features.length === 0) {
        console.warn("No feature found for GlobalID:", item.globalId);
        return;
      }

      const feature = response.data.features[0];

      const sourceLayer = mapView.map.layers.items.find(layer => {
        return (layer.url + "/" + layer.layerId) === item.featureLayerUrl;
      }) as FeatureLayer;      

      if (!sourceLayer) {
        console.warn("Layer not found for URL:", item.featureLayerUrl);
        return;
      }

      if(item.geometryType === "esriGeometryPoint"){
        const point = new Point({
          x: item.geometry.x, 
          y: item.geometry.y,
          spatialReference: mapView.spatialReference
        });

        const popupLocation = new Point({
          x: 0, 
          y: 0,
          spatialReference: mapView.spatialReference
        });

        const featureWithValidGeometry = {
          geometry: {
            type: "point",
            x: feature.geometry.x,
            y: feature.geometry.y,
            spatialReference: mapView.spatialReference
          },
          attributes: feature.attributes
        };

        const graphic = new Graphic({
          geometry: featureWithValidGeometry.geometry,
          attributes: featureWithValidGeometry.attributes,
          layer: sourceLayer
        });

        await mapView.goTo(
          {
            target: point,
            zoom: 18
          },
          {
            duration: 1000,
            easing: "in-out-cubic"
          }
        ).catch((error) => {
          console.error("Zoom failed:", error);
        });

        mapView.openPopup({
          features: [graphic],
          location: popupLocation
        });

      }
      else if(item.geometryType === "esriGeometryPolyline"){
        // first vertex of polyline
        const point = new Point({
          x: item.geometry.paths[0][0][0], 
          y: item.geometry.paths[0][0][1],
          spatialReference: mapView.spatialReference
        });

        const popupLocation = new Point({
          x: 0, 
          y: 0,
          spatialReference: mapView.spatialReference
        });

        const featureWithValidGeometry = {
          geometry: {
            type: "polyline",
            paths: feature.geometry.paths,
            spatialReference: mapView.spatialReference
          },
          attributes: feature.attributes
        };

        const graphic = new Graphic({
          geometry: featureWithValidGeometry.geometry,
          attributes: featureWithValidGeometry.attributes,
          layer: sourceLayer
        });

        await mapView.goTo(
          {
            target: point,
            zoom: 18
          },
          {
            duration: 1000,
            easing: "in-out-cubic"
          }
        ).catch((error) => {
          console.error("Zoom failed:", error);
        });

        mapView.openPopup({
          features: [graphic],
          location: popupLocation
        });
      }
    }
  }

  return (
    <div className="widget-styled-container">
      <JimuMapViewComponent useMapWidgetId={props.useMapWidgetIds?.[0]} onActiveViewChange={onActiveViewChange} />
      {/* Tab Navigation */}
      <div className="tab-nav">
        <button onClick={() => setActiveTab('input')} disabled={activeTab === 'input'}>
          Invoer
        </button>
        <button onClick={() => setActiveTab('results')} disabled={activeTab === 'results'}>
          Resultaten
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'input' && <div>
            <h4>Startpunten ({startingPointsCount})</h4>
            <p>Plaats één of meerdere startpunten.</p>
            {isSelectionMode === false && <button className="blue-button" onClick={activatePointSelection}>Plaats startpunt</button>}
            {isSelectionMode && <button className="blue-button-activated" onClick={activatePointSelection}>Plaats startpunt</button>}
            {(isSelectionMode && pointSelectionPopUpOpened) && (
              <div className="widget-relative-popup">
                Klik op de kaart om een startpunt te plaatsen.
              </div>
            )}
            <div style={{ marginTop: '1rem' }}>
              <ul style={{ listStyle: 'none', padding: 0}}>
                {selectedFeatureAssetGroupAndType.map((feature, index) => (
                  <li 
                    className="my-results-list" 
                    key={index}
                    style={{ padding: '8px', borderBottom: '1px solid #eee' }}
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            {startingPointsCount > 0 && !isTraceRunning && <div>
              <button className="red-button" onClick={clearAllResults}>Verwijder startpunten</button>
              <button className="blue-button" onClick={runTrace}>Voer lekanalyse uit</button>
            </div>
            }
            {startingPointsCount > 0 && isTraceRunning && <div>
              <button className="red-button" onClick={handleCancelTrace}>Annuleren</button>
              <button className="blue-button" onClick={runTrace} disabled={true}>Voer lekanalyse uit</button>
            </div>
            }
            {isTraceRunning && 
            <div className='is-trace-running-or-error'>
              <p>Lekanalyse wordt uitgevoerd...</p>
            </div>}
            {isTraceReturnError && 
            <div className='is-trace-running-or-error'>
              <span style={{ fontWeight: 'bold' }}>Lekanalyse mislukt. <br />Foutmelding: </span>{traceError}
              <br />
              <button className="grey-button" onClick={clearAllResults}>OK</button>
            </div>}
          </div>}
        {activeTab === 'results' && <div>
          {uniqueTraceResultsCount == 0 && <div>
            <h4>Resultaten ({uniqueTraceResultsCount})</h4>
          </div>
          }
          {uniqueTraceResultsCount > 0 && (
            <div>
              <h4>
                Resultaten (
                {afsluitersCount} {afsluitersCount === 1 ? 'afsluiter' : 'afsluiters'}, {' '}
                {aansluitingenCount} {aansluitingenCount === 1 ? 'aansluiting' : 'aansluitingen'}
                )
              </h4>
            </div>
          )}
          {findIsolatingValvesTraceResults.length > 0 && <div>
            {resultsToExport.length > 0 && (
              <button className="grey-button" onClick={() => exportToExcel(resultsToExport)}>Exporteer</button>
            )}
            <button className="red-button" onClick={clearAllResults}>Wis resultaten</button>
          </div>
          }
          <br /><br />
          <div>
            {groupedTraceResults_array.map((group, index) => (
              <div key={index}>
                <h4>{`${group.assetGroupCode} (${group.items[0].length+group.items[1].length})`}</h4>
                <ul style={{ listStyle: 'none', padding: 0}}>
                  {group.items[0].map(item => (
                    <li
                      className="important-accounts" 
                      key={item.objectId}
                      onClick={() => zoomOnObject(item)}
                      style={{ cursor: 'pointer', padding: '8px', borderBottom: '1px solid #eee' }}
                    >
                      {item.displayField} {item.displayFieldComplement}
                    </li>
                  ))}
                  {group.items[1].map(item => (
                    <li
                      key={item.objectId}
                      onClick={() => zoomOnObject(item)}
                      style={{ cursor: 'pointer', padding: '8px', borderBottom: '1px solid #eee' }}
                    >
                      {item.displayField}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </div>
  )
}