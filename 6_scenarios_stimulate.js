var pars_quality_final_ava_model4 = ee.FeatureCollection("projects/ee-modislst/assets/UrbanHeatIsland/pars_quality_final_ava_model4_novcqc_nowatermask");

//1-model selection
//Model4
var pars_quality_final_ava_model4_ISO3 = pars_quality_final_ava_model4.aggregate_array('ADM0_CODE').distinct()
print('city numbers',pars_quality_final_ava_model4.size())
print('country ISO',pars_quality_final_ava_model4_ISO3)

//2-data prepare
var Global_Cities = ee.FeatureCollection('projects/ee-modislst/assets/UrbanHeatIsland/Global_Cities3');
//SMOD
var smod = ee.Image("JRC/GHSL/P2023A/GHS_SMOD/2020").select('smod_code');
var smod_urban = smod.updateMask(smod.gte(22));
var smod_rural = smod.updateMask(smod.lt(20)).updateMask(smod.gt(10));

var VCF_vegetation_cover = ee.Image('projects/ee-modislst/assets/UrbanHeatIsland/VCF_vegetation_cover_raw').unmask(0)

Map.addLayer(VCF_vegetation_cover, {
  bands: ['vegetation_cover'],
  min: 0,
  max: 100,
  palette: ['bbe029', '0a9501', '074b03']
}, 'vegetation_cover',false);

//3-Computing scenarios
//3-1-construct building rooftop polygons
var code_list = pars_quality_final_ava_model4_ISO3.getInfo()
//for manual computation
//var code_list = ['ARG','BRA','JPN','MEX']

var result_list = ee.List([]);
for (var i in code_list) {
  var code = code_list[i];
  var buildings_link = 'projects/sat-io/open-datasets/VIDA_COMBINED/'+code;
  var buildings_polygon = ee.FeatureCollection(buildings_link);
  buildings_polygon = buildings_polygon.set('ISO',code);
  var result_list = result_list.add(buildings_polygon)
}
var all_buildings = ee.FeatureCollection(result_list)
print(all_buildings.size())
//var all_polys = ee.data.listAssets('projects/sat-io/open-datasets/VIDA_COMBINED/')

//3-2-functions to convert rooftops to VC
var scenario_compute = function(city,polys,percent,max_cover,vegetation_cover,ts){
  var scenario = polys.multiply(ee.Image.constant(percent)).add(vegetation_cover);
  //restrcit max VC
  var scenario = scenario.where(scenario.gte(ee.Image.constant(max_cover)),ee.Image.constant(max_cover));
  var scenario_change = scenario.subtract(vegetation_cover);
  var scenario_mean = scenario.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:city.geometry(), 
    scale:250, 
    crs:'EPSG:3857',
    maxPixels:1e12,
    tileScale:ts
  });
  var scenario_change_mean = scenario_change.reduceRegion({
    reducer:ee.Reducer.mean(), 
    geometry:city.geometry(), 
    scale:250, 
    crs:'EPSG:3857',
    maxPixels:1e12,
    tileScale:ts
  });
  var result = ee.Dictionary({'after':scenario_mean.get('roof'),'change':scenario_change_mean.get('roof')})
  return result
}

//3-3-batch computation
for (var i in code_list) {
  var code = code_list[i];
  
  //Country, ADM0_CODE is ISO code not number code
  var country_ava = pars_quality_final_ava_model4.filter(ee.Filter.eq('ADM0_CODE',code));
  //print(country_ava.size())

  var country_results = country_ava.map(function(country){
    
    var ADM0_CODE_ISO3_i = country.get('ADM0_CODE')
    var ADM2_CODE_i = country.get('ADM2CODE')
    
    var country_city = Global_Cities.filter(ee.Filter.eq('ADM2_CODE',ADM2_CODE_i)).first();
    var buildings_polygon = all_buildings.filter(ee.Filter.eq('ISO',ADM0_CODE_ISO3_i)).flatten();
    
    //Fix inverted polygons
    buildings_polygon = buildings_polygon.filter(ee.Filter.bounds(ee.Geometry.Point([0,0])).not())
                                            .filterBounds(country_city.geometry())
    
    //roof to 2.5m raster
    var buildings_polygon_raster = buildings_polygon
      .map(function(roof){
        return roof.set('roof',1)})
      .reduceToImage(['roof'], ee.Reducer.first())
      .rename('roof').reproject('EPSG:3857',null,2.5);
    
    //reduce resolution, 2 steps to reduce memory stress
    var buildings_polygon_raster_25m = buildings_polygon_raster
      .reduceResolution({
      reducer:ee.Reducer.sum().unweighted(), 
      maxPixels:256
      }).reproject('EPSG:3857',null,25);
      
    var buildings_polygon_raster_250m = buildings_polygon_raster_25m
      .reduceResolution({
      reducer:ee.Reducer.sum().unweighted(), 
      maxPixels:256
      }).reproject('EPSG:3857',null,250).divide(100).updateMask(smod_urban)
  
    var city = country_city;
    
    var max_tcc = VCF_vegetation_cover.reduceRegion({
      reducer:ee.Reducer.max(), 
      geometry:city.geometry().bounds(1).buffer(10000).bounds(1), 
      scale:250, 
      crs:'EPSG:3857',
      maxPixels:1e12
    }).get('vegetation_cover');
    max_tcc = ee.Number(max_tcc);
    
    //scenarios
    var scenario_low = scenario_compute(city,buildings_polygon_raster_250m,0.2,max_tcc,VCF_vegetation_cover,12)
    var scenario_mid = scenario_compute(city,buildings_polygon_raster_250m,0.4,max_tcc,VCF_vegetation_cover,12)
    var scenario_hig = scenario_compute(city,buildings_polygon_raster_250m,0.6,max_tcc,VCF_vegetation_cover,12)
    
    var city_result = city.set('low_cc',scenario_low.get('after'),'low_cc_change',scenario_low.get('change'),
                              'medium_cc',scenario_mid.get('after'),'medium_cc_change',scenario_mid.get('change'),
                              'high_cc',scenario_hig.get('after'),'high_cc_change',scenario_hig.get('change'),
                              'max_cc',max_tcc)
                          //.setGeometry();
    
    return city_result //ee.Feature(null).set('code',ADM2_CODE_i) //city_result
  });
  
  //print(country_results.first())
  
  Export.table.toDrive({
    collection:country_results, 
    description:'GRs_result_urban_v2_'+code, 
    folder:'GRs_202411', 
    fileFormat:'csv'
  })

}