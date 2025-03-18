 var LST = ee.ImageCollection('MODIS/061/MYD11A1') 

var bitwiseExtract = function(input, fromBit, toBit) {
  var maskSize = ee.Number(1).add(toBit).subtract(fromBit)
  var mask = ee.Number(1).leftShift(maskSize).subtract(1)
  return input.rightShift(fromBit).bitwiseAnd(mask)
}

var qc_day_mask = function(image){
  var qcDay = image.select('QC_Day')
  var qaMask = bitwiseExtract(qcDay, 0, 1).lte(1)
  var dataQualityMask = bitwiseExtract(qcDay, 2, 3).eq(0)
  var lstErrorMask = bitwiseExtract(qcDay, 6, 7).eq(1)
  var mask = qaMask.and(dataQualityMask).and(lstErrorMask)
  return image.updateMask(mask)
}

var qc_night_mask = function(image){
  var qcNight = image.select('QC_Night')
  var qaMask = bitwiseExtract(qcNight, 0, 1).lte(1)
  var dataQualityMask = bitwiseExtract(qcNight, 2, 3).eq(0)
  var lstErrorMask = bitwiseExtract(qcNight, 6, 7).lte(1)
  var mask = qaMask.and(dataQualityMask).and(lstErrorMask)
  return image.updateMask(mask)
}

var LST_JJA_Day = LST.filter(ee.Filter.calendarRange(6, 8, 'month'))
                  .filter(ee.Filter.calendarRange(2016, 2020, 'year'))
                  .map(qc_day_mask)
                  .select(['LST_Day_1km']).mean()
var LST_JJA_Night = LST.filter(ee.Filter.calendarRange(6, 8, 'month'))
                  .filter(ee.Filter.calendarRange(2016, 2020, 'year'))
                  .map(qc_night_mask)
                  .select(['LST_Night_1km']).mean()
                  
var LST_DJF_Day = LST.filter(ee.Filter.calendarRange(12, 2, 'month'))
                  .filter(ee.Filter.calendarRange(2016, 2020, 'year'))
                  .map(qc_day_mask)
                  .select(['LST_Day_1km',]).mean()

var LST_DJF_Night = LST.filter(ee.Filter.calendarRange(12, 2, 'month'))
                  .filter(ee.Filter.calendarRange(2016, 2020, 'year'))
                  .map(qc_night_mask)
                  .select(['LST_Night_1km']).mean();
                  
var LST_JJA = LST_JJA_Day.addBands(LST_JJA_Night)
var LST_DJF = LST_DJF_Day.addBands(LST_DJF_Night)

var North_sphere = ee.Geometry.BBox(-180,0,180,89.9);
var South_sphere = ee.Geometry.BBox(-180,-65,180,0);

Map.addLayer(North_sphere,{},'North_sphere')
Map.addLayer(South_sphere,{},'South_sphere')
//print(LST_JJA)
var LST_North_sphere = LST_JJA.clip(North_sphere);
var LST_South_sphere = LST_DJF.clip(South_sphere);
//var South_sphere = South_sphere.reduceToImage()
var LST_NS = ee.ImageCollection([LST_North_sphere,LST_South_sphere]).mosaic()

var landSurfaceTemperatureVis = {
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
Map.setCenter(6.746, 46.529, 2);
Map.addLayer(LST_NS.select('LST_Day_1km').multiply(0.02), landSurfaceTemperatureVis, 'LST_NS');
Map.addLayer(LST_North_sphere.select('LST_Day_1km').multiply(0.02), landSurfaceTemperatureVis, 'LST_North_sphere');
Map.addLayer(LST_South_sphere.select('LST_Day_1km').multiply(0.02), landSurfaceTemperatureVis, 'LST_South_sphere');


Export.image.toAsset({
  image:LST_NS, 
  description:'LST_NS_2016_2020_qc', 
  assetId:'projects/ee-modislst/assets/UrbanHeatIsland/LST_NS_2016_2020_qc', 
  scale:1000, 
  crs:'EPSG:4326', 
  maxPixels:1E12})