//1-prepare cities 

var Global_Cities = ee.FeatureCollection('projects/ee-modislst/assets/UrbanHeatIsland/Global_Cities3');
print('City numbers',Global_Cities.size())

//SMOD
var smod = ee.Image("JRC/GHSL/P2023A/GHS_SMOD/2020").select('smod_code');
var smod_urban = smod.updateMask(smod.gte(22));
var smod_rural = smod.updateMask(smod.lt(20)).updateMask(smod.gt(10));
Map.addLayer(smod,{},'smod_inspect',false)
Map.addLayer(smod_urban,{palette:'red'},'smod_urban',false)
Map.addLayer(smod_rural,{palette:'green'},'smod_rural',false)

//2-population
//Because this collection has a pyramid policy of MEAN, 
//zooming out results in information loss. Calculations need to be performed at native resolution.
var pop_count = ee.ImageCollection("CIESIN/GPWv411/GPW_Population_Count").filterDate('2020','2021').first().select('population_count');
var pop_count_urban = pop_count.updateMask(smod_urban);

var pop_vis = {
  'max': 1000.0,
  'palette': [
    'ffffe7',
    '86a192',
    '509791',
    '307296',
    '2c4484',
    '000066'
  ],
  'min': 0.0
};
Map.addLayer(pop_count_urban, pop_vis, 'pop_count_urban',false);

var cities_filtered = Global_Cities.map(function(c){
  var pop_c = pop_count_urban.reduceRegion({
    reducer:ee.Reducer.sum(), 
    geometry:c.geometry(), 
    scale:927.67, 
    crs:'EPSG:3857',
    maxPixels:1e12
  })
  return c.set(pop_c)
})

//3-climate regions
// var koppen_climate = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/koppen_geiger_0p00833333')
// Map.addLayer(koppen_climate.randomVisualizer(), {}, 'koppen_climate',false);
// var koppen_climate_remap =  koppen_climate.remap(
//   ee.List.sequence(1, 30, 1), 
//   ee.List([1,1,1,
//   2,2,2,2,
//   3,3,3,3,3,3,3,3,3,
//   4,4,4,4,4,4,4,4,4,4,4,4,
//   5,5]), 
//   0,
//   'b1').rename('b1')
  
// Map.addLayer(koppen_climate_remap.randomVisualizer(), {}, 'koppen_climate_remap',false);
// var cities_filtered = cities_filtered.map(function(c){
//   var kop_c = koppen_climate.reduceRegion({
//     reducer:ee.Reducer.mode(), 
//     geometry:c.geometry(), 
//     scale:1000, 
//     crs:'EPSG:3857',
//     maxPixels:1e12
//   })
//   var kop_remap_c = koppen_climate_remap.reduceRegion({
//     reducer:ee.Reducer.mode(), 
//     geometry:c.geometry(), 
//     scale:1000, 
//     crs:'EPSG:3857',
//     maxPixels:1e12
//   })
//   return c.set('koppen_climate',kop_c.get('b1')).set('koppen_climate_remap',kop_remap_c.get('b1'))
// })

// print(cities_filtered.first())
// Map.addLayer(cities_filtered,{},'cities_filtered_pop_climate',false)

//4-background temperature
var LST_NS_value = LST_NS.multiply(0.02)
var LST_urban = LST_NS_value.updateMask(smod_urban);
var LST_rural = LST_NS_value.updateMask(smod_rural);

var cities_filtered = cities_filtered.map(function(c){
  var lst_urban_mean = LST_urban.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:c.geometry(), 
    scale:1000, 
    crs:'EPSG:3857',
    maxPixels:1e12 
  })
  var lst_rural_mean = LST_rural.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:c.geometry(), 
    scale:1000, 
    crs:'EPSG:3857',
    maxPixels:1e12 
  })
  return c.set('LST_urban_day_mean',lst_urban_mean.get('LST_Day_1km'))
          .set('LST_urban_night_mean',lst_urban_mean.get('LST_Night_1km'))
          .set('LST_rural_day_mean',lst_rural_mean.get('LST_Day_1km'))
          .set('LST_rural_night_mean',lst_rural_mean.get('LST_Night_1km'))
})


//5-background vc
var VCF = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/VCF_vegetation_cover_raw');
var VCF_urban = VCF.updateMask(smod_urban);
Map.addLayer(VCF_urban,{},'VCF_urban')

var cities_filtered = cities_filtered.map(function(c){
  var VC_mean = VCF_urban.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:c.geometry(), 
    scale:250, 
    crs:'EPSG:3857',
    maxPixels:1e12 
  })
  return c.set('vc_mean',VC_mean.get('vegetation_cover'))
})

//6-urban area
var cities_filtered = cities_filtered.map(function(c){
  var urban_area = ee.Image.pixelArea().updateMask(smod_urban).reduceRegion({
    reducer:ee.Reducer.sum(), 
    geometry:c.geometry(), 
    scale:1000, 
    crs:'EPSG:3857',
    maxPixels:1e12 
  })
  return c.set('urban_area',urban_area.get('area'))
})

print('urban_area_check',cities_filtered.first())

var export_props = cities_filtered.first().propertyNames().getInfo()

Export.table.toDrive({
  collection:cities_filtered, 
  description:'Urban_stat_lst_vc_rural_urban', 
  folder:'GRs_202412_stat_all_city', 
  fileFormat:'csv',
  selectors:export_props
});



// //UHII ONLY
// var cities_uhii = Global_Cities.map(function(c){
//   var uhii_mean = UHII.reduceRegion({
//     reducer:ee.Reducer.mean(), 
//     geometry:c.geometry(), 
//     scale:1000, 
//     crs:'EPSG:3857',
//     maxPixels:1e12 
//   })
//   return c.set('UHII_day',uhii_mean.get('Daytime'),
//                 'UHII_night',uhii_mean.get('Nighttime'))
// })

// //print(cities_uhii.limit(200))

// Export.table.toDrive({
//   collection:cities_uhii, 
//   description:'Urban_stat_uhii', 
//   folder:'GRs_202412_stat_all_city', 
//   fileFormat:'csv',
//   selectors:['ADM2_CODE','UHII_day','UHII_night']
//   });


// //calculate city with urban area only
var model4_urban = ee.FeatureCollection('projects/ee-modislst/assets/UrbanHeatIsland/pars_quality_final_ava_model4_allpixel_watermask0')
print(model4_urban.size())

//6 - roof area
var city_urbanarea_ISO3 = model4_urban.aggregate_array('ISOCODE').distinct()
var code_list = city_urbanarea_ISO3.getInfo()

var result_list = ee.List([]);
for (var i in code_list) {
  var code = code_list[i];
  var buildings_link = 'projects/sat-io/open-datasets/VIDA_COMBINED/'+code;
  var buildings_polygon = ee.FeatureCollection(buildings_link);
  buildings_polygon = buildings_polygon.set('ISO',code);
  var result_list = result_list.add(buildings_polygon)
}
var all_buildings = ee.FeatureCollection(result_list)


//city_urbanarea
// var test_city = city_urbanarea.filter(ee.Filter.eq('ADM2CODE',34410))
// print(test_city)

var cities_filtered_1 = model4_urban.map(function(c){
  var c_adm0 = c.get('ISOCODE')
  var c_adm2 = c.get('ADM2CODE')
  var c_geo = Global_Cities.filter(ee.Filter.eq('ADM2_CODE',c_adm2)).first()
  
  var adm0_buildings = all_buildings.filter(ee.Filter.eq('ISO',c_adm0)).flatten();
  var adm2_buildings = adm0_buildings.filter(ee.Filter.bounds(ee.Geometry.Point([0,0])).not())
                                      .filterBounds(c_geo.geometry())
  
  var adm2_buildings_raster = adm2_buildings
      .map(function(roof){
        return roof.set('roof',1)})
      .reduceToImage(['roof'], ee.Reducer.first())
      .rename('roof').reproject('EPSG:3857',null,2.5);
      
  var adm2_buildings_raster_urban = ee.Image.pixelArea().updateMask(adm2_buildings_raster).updateMask(smod_urban);
  var adm2_buildings_raster_urban_area = adm2_buildings_raster_urban.select('area').reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry:c_geo.geometry(),
    scale:2.5,
    crs:'EPSG:3857',
    maxPixels:1e13
  })
  return c_geo.set('roof_area',adm2_buildings_raster_urban_area.getNumber('area'))
})

print('roof_check',cities_filtered_1.limit(5))
// print(cities_filtered_1.first().propertyNames().getInfo())

Export.table.toDrive({
  collection:cities_filtered_1, 
  description:'Urban_stat_lst_roofarea_global_exchina', 
  folder:'GRs_202501_stat', 
  fileFormat:'csv',
  selectors:cities_filtered_1.first().propertyNames().getInfo()
  });
  
//china roof area
var chn_cities = Global_Cities.filter(ee.Filter.eq('ADM0_CODE',147295))
// print(chn_cities)

var CBRA_2021 = ee.Image('projects/ee-modislst/assets/CBRA_2021')
var buildings_polygon = ee.Image(1).rename('roof').setDefaultProjection('EPSG:3857',null,2.5).addBands(ee.Image.pixelArea()).updateMask(CBRA_2021).updateMask(smod_urban)
Map.addLayer(buildings_polygon,{band:'area'},'buildings_polygon_chn',false)

var cities_filtered_2 = chn_cities.map(function(c){
  var adm2_buildings_raster_urban_area = buildings_polygon.select('area').reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry:c.geometry(),
    scale:2.5,
    crs:'EPSG:3857',
    maxPixels:1e13
  })
  return c.set('roof_area',adm2_buildings_raster_urban_area.getNumber('area'))
})

print('china_roof_check',cities_filtered_2.first())

Export.table.toDrive({
  collection:cities_filtered_2, 
  description:'Urban_stat_lst_roofarea_chn', 
  folder:'GRs_202412_stat2',
  fileFormat:'csv',
  selectors:cities_filtered_1.first().propertyNames().getInfo()
  });
  
//china taiwan
var chn_taiwan_cities = Global_Cities.filter(ee.Filter.eq('ADM0_CODE',147296))

var cities_filtered_3 = chn_taiwan_cities.map(function(c){
  var adm2_buildings_raster_urban_area = buildings_polygon.select('area').reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry:c.geometry(),
    scale:2.5,
    crs:'EPSG:3857',
    maxPixels:1e13
  })
  return c.set('roof_area',adm2_buildings_raster_urban_area.getNumber('area'))
})

// print(cities_filtered_3.first())

Export.table.toDrive({
  collection:cities_filtered_3, 
  description:'Urban_stat_lst_roofarea_chn_taiwan', 
  folder:'GRs_202412_stat2',
  fileFormat:'csv',
  selectors:cities_filtered_1.first().propertyNames().getInfo()
  });