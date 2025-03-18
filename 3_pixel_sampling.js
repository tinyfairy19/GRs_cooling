var Settlement_Grid_30_v = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/Settlement_Grid_30_v"),
    city_200 = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/SampleCites"),
    bound_diagonals = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/bound_diagonals"),
    bound_diagonals_city200 = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/bound_diagonals_city200"),
    bound_diagonals_10km_buffer = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/bound_diagonals_10kmbuffer"),
    bound_star = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/bound_star");

//0-DATA PREPARATION
//0-1 GHSL
var Settlement_Grid = ee.ImageCollection("projects/sat-io/open-datasets/GHS/GHS_SMOD").mosaic()
Map.addLayer(Settlement_Grid.updateMask(Settlement_Grid.eq(30)), {min: 10,max: 30,palette: ['000000', '448564', '70daa4', 'ffffff']}, 'Degree of Urbanization 2023',false)

var Settlement_Grid_centroid = Settlement_Grid_30_v.map(function(i){
  return i.centroid().set('area',i.area(1))
})
print(Settlement_Grid_centroid.first())
Map.addLayer(Settlement_Grid_centroid, {}, 'Settlement_Grid_centroid',false)

//0-2 Watermask
var waterbody = ee.Image("MODIS/MOD44W/MOD44W_005_2000_02_24")
var waterMask = waterbody.select('water_mask');
var waterMaskVis = {
  min: 0.0,
  max: 1,
};
Map.addLayer(waterMask, waterMaskVis, 'Water Mask',false);

//watermask function
var water_mask = function(tomask,maxDistM){
  // Calculate distance to target pixels. Several distance kernels are provided.
  // Euclidean distance.
  var euclideanKernel = ee.Kernel.euclidean(maxDistM, 'meters');
  var distance_to_water = waterMask.distance(euclideanKernel).gte(0).unmask(0);
  var vis = {min: 0, max: maxDistM};
  return tomask.updateMask(distance_to_water.select('water_mask').eq(0))
}

//0-3 global cities
var Global_Cities = ee.FeatureCollection('projects/ee-modislst/assets/UrbanHeatIsland/Global_Cities3');
Map.addLayer(Global_Cities,{color:'blue'},'Global_Cities3',false)

//1 VARIABLES

//1-1 LST
var LST_MODIS_mean = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/LST_NS_2016_2020_qc')

//LST
Map.addLayer(LST_MODIS_mean.multiply(0.02), {
  bands:'LST_Day_1km',
  min:260,
  max:330,
  palette:[
    '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'
  ],
}, 'LST_Day_1km',false);

//1-2 GFCC
var GFCC = ee.ImageCollection('NASA/MEASURES/GFCC/TC/v3')
                  .filter(ee.Filter.date('2015-01-01', '2015-12-31'));
                  
var treeCanopyCover = GFCC.select('tree_canopy_cover').mean();

var treeCanopyCoverVis = {
  min: 0.0,
  max: 100.0,
  palette: ['ffffff', 'afce56', '5f9c00', '0e6a00', '003800'],
};

Map.addLayer(treeCanopyCover, treeCanopyCoverVis, 'Tree Canopy Cover',false);

//1-3 VCF
var VCF = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/VCF_vegetation_cover_raw');

Map.addLayer(VCF, {
  bands: ['vegetation_cover'],
  min: 0,
  max: 100,
  palette: ['bbe029', '0a9501', '074b03']
}, 'vegetation_cover',false);

//1-4 NDVI EVI
var MODIS_NDVI_EVI = ee.Image("projects/ee-modislst/assets/UrbanHeatIsland/NDVI_EVI_NS_2016_2020_qc").unmask(-999)

var ndviVis = {
  bands: ['NDVI'],
  min: 0,
  max: 9000,
  palette: [
    'ffffff', 'ce7e45', 'df923d', 'f1b555', 'fcd163', '99b718', '74a901',
    '66a000', '529400', '3e8601', '207401', '056201', '004c00', '023b01',
    '012e01', '011d01', '011301'
  ],
};
Map.addLayer(MODIS_NDVI_EVI, ndviVis, 'MODIS_NDVI_EVI',false);

//1-5 albedo 
var landsat_albedo = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/LST_NS_Landsat_2016_2020_1km_mean')
var landsat_albedo = landsat_albedo.select('albedo')

//1-6 Building_height
var Building_height = ee.Image("JRC/GHSL/P2023A/GHS_BUILT_H/2018").select('built_height');
Map.addLayer(Building_height, {
  min: 0.0,
  max: 12.0,
  palette: ['000000', '0d0887', '7e03a8', 'cc4778', 'f89540', 'f0f921'],
}, 'Average building height [m], 2018',false);

//1-7 Building Volume
var volume_total_2020 = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_V/2020').select('built_volume_total');
//print(ee.data.listAssets('JRC/GHSL/P2023A/GHS_BUILT_H'))

Map.addLayer(volume_total_2020, {
  min: 0,
  max: 80000,
  palette: ['000004', '51127c', 'b73779', 'fc8961', 'fcfdbf'],
}, 'Total building volume [m3], 2020',false);

//1-8 Building_height variance
var Building_height_variance = Building_height.selfMask().reduceResolution({
  reducer:ee.Reducer.stdDev(),
  //bestEffort:true,
  maxPixels:4096
}).unmask(0).rename('Building_height_variance').reproject("EPSG:3857",null,1000) 

Map.addLayer(Building_height_variance, {}, 'Building_height_variance',false);


//1-9 building density
var buildings_count = Building_height.selfMask().reduceResolution({
  reducer:ee.Reducer.count(),
  //bestEffort:true,
  maxPixels:4096
}).unmask(0).rename('building_count').reproject("EPSG:3857",null,1000) 

Map.addLayer(buildings_count, {}, 'buildings_count',false);

//1-10 SRTM
var srtm_dem = ee.Image("CGIAR/SRTM90_V4").rename('srtm_dem');
var merit_dem = ee.Image('MERIT/DEM/v1_0_3').rename('merit_dem');

//1-11 Building Materials proportion
var WSF_MS = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/WSF_MS_percentage')
                    .rename(['f_bio','f_fossil','f_metals','f_minerals'])

var all_layers = LST_MODIS_mean.addBands(treeCanopyCover).addBands(VCF)
                                .addBands(MODIS_NDVI_EVI).addBands(landsat_albedo)
                                .addBands(Building_height).addBands(buildings_count).addBands(Building_height_variance)
                                .addBands(srtm_dem).addBands(merit_dem).addBands(WSF_MS)
                                
Map.addLayer(all_layers,{},'all_layers_inspect',false)

var all_layers_watermask0 = water_mask(all_layers,0).unmask(-999)
var all_layers_watermask2000 = water_mask(all_layers,2000).unmask(-999)

//2 reduce to list

/////TEST1-200 CITY DIAGONAL VS ALLPIXEL/////
// var select_reducer = ee.Reducer.toList()
// var sphere = ee.Geometry.BBox(-180,-89.9,180,89.9);

// //diagonals
// var city_200_diagonal = bound_diagonals_city200.map(function(city){ //test_roi,bound_diagonals_10km_buffer,Sample_Cities,buffer_diagonals,max_min_lines
//   var city_result = all_layers_watermask0.reduceRegion({
//     reducer:select_reducer, 
//     geometry:city.geometry().intersection(sphere,1), 
//     scale:1000,
//     crs:'EPSG:3857',
//     maxPixels:1e10,
//     tileScale:8
//   })
//   return city.set(city_result)
//               .set('geometry_type', city.geometry().type());
// })
// print(city_200_diagonal.limit(5))

// //export
// Export.table.toDrive({
//   collection:city_200_diagonal, 
//   description:'city_200_diagonal', 
//   folder:'UrbanHeatIsland2025TEST', 
//   fileFormat:'csv',
//   selectors:city_200_diagonal.first().propertyNames().getInfo()
//   });
  
// //bounds
// var city_200_bounds = bound_diagonals_city200.map(function(city){ //test_roi,bound_diagonals_10km_buffer,Sample_Cities,buffer_diagonals,max_min_lines
//   var city_result = all_layers_watermask0.reduceRegion({
//     reducer:select_reducer, 
//     geometry:city.geometry().bounds(1).intersection(sphere,1), 
//     scale:1000,
//     crs:'EPSG:3857',
//     maxPixels:1e10,
//     tileScale:8
//   })
//   return city.set(city_result)
//               .set('geometry_type', city.geometry().type());
// })

// Export.table.toDrive({
//   collection:city_200_bounds, 
//   description:'city_200_bounds', 
//   folder:'UrbanHeatIsland2025TEST', 
//   fileFormat:'csv',
//   selectors:city_200_bounds.first().propertyNames().getInfo()
//   });
  
  
/////TEST2-all CITY DIAGONAL VS ALLPIXEL/////
// var select_reducer = ee.Reducer.toList()
// var sphere = ee.Geometry.BBox(-180,-89.9,180,89.9);

// //diagonals
// var city_all_diagonal = bound_diagonals_10km_buffer.map(function(city){ //test_roi,bound_diagonals_10km_buffer,Sample_Cities,buffer_diagonals,max_min_lines
//   var city_result = all_layers_watermask0.reduceRegion({
//     reducer:select_reducer, 
//     geometry:city.geometry().intersection(sphere,1), 
//     scale:1000,
//     crs:'EPSG:3857',
//     maxPixels:1e10,
//     tileScale:8
//   })
//   return city.set(city_result)
//               .set('geometry_type', city.geometry().type());
// })
// print(city_all_diagonal.limit(5))

// //export
// Export.table.toDrive({
//   collection:city_all_diagonal, 
//   description:'city_all_diagonal', 
//   folder:'UrbanHeatIsland2025TEST', 
//   fileFormat:'csv',
//   selectors:city_all_diagonal.first().propertyNames().getInfo()
//   });
  
// //all pixels
// print(Global_Cities.first())
var adm2_code_raster = Global_Cities.reduceToImage({
  properties:['ADM2_CODE'],
  reducer:ee.Reducer.first()
}).rename('ADM2_CODE')
Map.addLayer(adm2_code_raster.randomVisualizer(),{},'adm2_code_raster',false)
var all_layers_watermask0_adm2code = all_layers_watermask0.addBands(adm2_code_raster).toFloat()
var all_layers_watermask2000_adm2code = all_layers_watermask2000.addBands(adm2_code_raster).toFloat()
print(all_layers_watermask0_adm2code)

Export.image.toDrive({
  image:all_layers_watermask0_adm2code,
  description:'all_layers_watermask0_adm2code',
  folder:'UrbanHeatIsland202501',
  scale:1000,
  crs:'EPSG:3857',
  maxPixels:1e12})	

Export.image.toDrive({
  image:all_layers_watermask2000_adm2code,
  description:'all_layers_watermask2000_adm2code',
  folder:'UrbanHeatIsland202501',
  scale:1000,
  crs:'EPSG:3857',
  maxPixels:1e12})

/////TEST3-STAR/////
// var select_reducer = ee.Reducer.toList()
// var sphere = ee.Geometry.BBox(-180,-89.9,180,89.9);
// var bound_star_f = bound_star.filterBounds(ee.Geometry.BBox(-180,-56,180,89.9))
// //diagonals
// var city_all_star = bound_star_f.map(function(city){ //test_roi,bound_diagonals_10km_buffer,Sample_Cities,buffer_diagonals,max_min_lines
//   var city_result = all_layers_watermask0.reduceRegion({
//     reducer:select_reducer, 
//     geometry:city.intersection(sphere,1).geometry(), 
//     scale:1000,
//     crs:'EPSG:3857',
//     maxPixels:1e10,
//     tileScale:8
//   })
//   return city.set(city_result)
//               .set('geometry_type', city.geometry().type());
// })
// print(city_all_star.limit(5))

// //export
// Export.table.toDrive({
//   collection:city_all_star, 
//   description:'city_all_star', 
//   folder:'UrbanHeatIsland2025TEST', 
//   fileFormat:'csv',
//   selectors:city_all_star.first().propertyNames().getInfo()
//   });