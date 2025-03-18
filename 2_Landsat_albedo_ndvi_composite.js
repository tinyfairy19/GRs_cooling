// Applies scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// reomove cloud for Landsat-8
function cloudRemoval(image) { 
  // 
  var cloudShadowBitMask = (1 << 4); 
  var cloudsBitMask = (1 << 3); 
  var qa = image.select('QA_PIXEL'); 
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0) 
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0)); 
  var mask2 = image.select("SR_B2").gt(0.2);                 
  return image.updateMask(mask).updateMask(mask2.not()).toDouble()
              .copyProperties(image)
              .copyProperties(image, ["system:time_start"]);
} 


var LC8_BANDS = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','ST_B10','QA_PIXEL']; //Landsat 8
//var STD_NAMES = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2','QA_PIXEL'];


var year_start = 2016;
var year_end = 2020;
var month_start_n = 6;
var month_end_n = 8;

var month_start_s = 12;
var month_end_s = 2;

var L8Col_N = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filter(ee.Filter.calendarRange(year_start,year_end,'year'))
                .filter(ee.Filter.calendarRange(month_start_n,month_end_n,'month'))
                .map(applyScaleFactors)
                .select(LC8_BANDS)
                .map(cloudRemoval).mean();
                
var L8Col_S = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filter(ee.Filter.calendarRange(year_start,year_end,'year'))
                .filter(ee.Filter.calendarRange(month_start_s,month_end_s,'month'))
                .map(applyScaleFactors)
                .select(LC8_BANDS)
                .map(cloudRemoval).mean();
                
//print(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').filterBounds(geometry)
//                .filter(ee.Filter.calendarRange(year_start,year_end,'year'))
//                .filter(ee.Filter.calendarRange(month_start_s,month_end_s,'month')))
                
//var visParam = {
//  bands:["ST_B10"],
//  min: 273,
//  max: 330,
//};
//
//Map.addLayer(L8Col_N, visParam, 'L8Col_N',false);
//Map.addLayer(L8Col_S, visParam, 'L8Col_S',false);

var North_sphere = ee.Geometry.BBox(-180,0,180,89.9);
var South_sphere = ee.Geometry.BBox(-180,-65,180,0);

Map.addLayer(North_sphere,{},'North_sphere',false)
Map.addLayer(South_sphere,{},'South_sphere',false)
//print(LST_JJA)
var LST_North_sphere = L8Col_N.clip(North_sphere);
var LST_South_sphere = L8Col_S.clip(South_sphere);
//var South_sphere = South_sphere.reduceToImage()
var LST_NS = ee.ImageCollection([LST_North_sphere,LST_South_sphere]).mosaic()

//1-5 albedo ?
//https://www.mdpi.com/2072-4292/13/4/799
var a_2 = LST_NS.select('SR_B2')
var a_4 = LST_NS.select('SR_B4')
var a_5 = LST_NS.select('SR_B5')
var a_6 = LST_NS.select('SR_B6')
var a_7 = LST_NS.select('SR_B7')
var alpha = ee.Image.constant(0.356).multiply(a_2)
        .add(ee.Image.constant(0.130).multiply(a_4))
        .add(ee.Image.constant(0.373).multiply(a_5))
        .add(ee.Image.constant(0.085).multiply(a_6))
        .add(ee.Image.constant(0.072).multiply(a_7))
        .subtract(ee.Image.constant(0.0018))
        .rename('albedo')
Map.addLayer(alpha,{palette: ['bbe029', '0a9501', '074b03']},'alpha',false)

var nirBand = 'SR_B5';
var redBand = 'SR_B4';
var ndvi = LST_NS.normalizedDifference([nirBand, redBand]).rename('NDVI');
var LST_NS = LST_NS.addBands(alpha).addBands(ndvi)
var albedo_ndvi = alpha.addBands(ndvi);


var landSurfaceTemperatureVis = {
  bands:['ST_B10'],
  min: 216.0,
  max: 348.0,
  palette: [
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ],
};
var colorizedVis = {
  bands:['NDVI'],
  min: 0,
  max: 1,
  palette: [
    'ffffff', 'ce7e45', 'df923d', 'f1b555', 'fcd163', '99b718', '74a901',
    '66a000', '529400', '3e8601', '207401', '056201', '004c00', '023b01',
    '012e01', '011d01', '011301'
  ],
};

Map.addLayer(albedo_ndvi, colorizedVis, 'NDVI');
Map.addLayer(LST_NS, landSurfaceTemperatureVis, 'LST_NS');
Map.addLayer(LST_North_sphere, landSurfaceTemperatureVis, 'LST_North_sphere');
Map.addLayer(LST_South_sphere, landSurfaceTemperatureVis, 'LST_South_sphere');
var waterbody = ee.Image("MODIS/MOD44W/MOD44W_005_2000_02_24")
var waterMask = waterbody.select('water_mask');
var waterMaskVis = {
  min: 0.0,
  max: 1,
};
Map.addLayer(waterMask, waterMaskVis, 'Water Mask',false);

Export.image.toAsset({
  image:LST_NS, 
  description:'LST_NS_Landsat_2016_2020', 
  assetId:'projects/ee-modislst/assets/UrbanHeatIsland/LST_NS_Landsat_2016_2020_1km_mean', 
  scale:1000, 
  crs:'EPSG:3857', 
  maxPixels:1E13})

var albedo_ndvi_int = albedo_ndvi.multiply(1000).toUint16()
Map.addLayer(albedo_ndvi_int, {}, 'albedo_ndvi_int',false);
Export.image.toAsset({
  image:albedo_ndvi_int, 
  description:'albedo_ndvi_NS_Landsat_2016_2020_100m', 
  assetId:'projects/ee-modislst/assets/UrbanHeatIsland/albedo_ndvi_NS_Landsat_2016_2020_100m', 
  scale:100, 
  crs:'EPSG:3857', 
  maxPixels:1E13})
  
Export.image.toCloudStorage({
  image: albedo_ndvi_int,
  description: 'albedo_ndvi_NS_Landsat_2016_2020',
  bucket: 'rs-images-bh',
  fileNamePrefix: 'albedo_ndvi_NS_Landsat_2016_2020',
  scale: 30,
  crs: 'EPSG:3857',
  formatOptions: {
    cloudOptimized: true
  }, 
  maxPixels:1E13
});
  
//print(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').first().select('ST_B10').projection())
var AlbedoVis = {
  bands:['albedo'],
  min: 0.0,
  max: 1.0,
};

var LS_hist = LST_NS.select(['albedo','NDVI']).setDefaultProjection('EPSG:3857',null,30)

Map.addLayer(LS_hist.select('albedo'),AlbedoVis,'albedo_proj',false)

var LS_hist = LS_hist.reduceResolution({
  reducer:ee.Reducer.fixedHistogram(0, 1, 10, true),
  maxPixels:4096}).reproject('EPSG:3857',null,1000)
  
print(LS_hist)

Map.addLayer(LS_hist,AlbedoVis,'albedo_1km',false)

Export.image.toAsset({
  image:LS_hist, 
  description:'LST_NS_Landsat_2016_2020_hist', 
  assetId:'projects/ee-modislst/assets/UrbanHeatIsland/LST_NS_Landsat_2016_2020_1km_hist', 
  scale:1000, 
  crs:'EPSG:3857', 
  maxPixels:1E13})