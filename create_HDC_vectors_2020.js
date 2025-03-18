var Settlement_Grid = ee.ImageCollection("projects/sat-io/open-datasets/GHS/GHS_SMOD")
                        .filter("id_no == 'GHS_SMOD_E2020_GLOBE_R2023A_54009_1000_V1_0'")
print(Settlement_Grid)
var glob = ee.Geometry.BBox(-180, -90, 180, 90)
Map.addLayer(Settlement_Grid, {min: 10,max: 30,palette: ['000000', '448564', '70daa4', 'ffffff']}, 'Degree of Urbanization 2023',false)
var Settlement_Grid_30 = Settlement_Grid.map(function(i){
  return i.updateMask(i.eq(30))
})
Map.addLayer(Settlement_Grid_30, {min: 10,max: 30,palette: ['000000', '448564', '70daa4', 'ffffff']}, 'Settlement_Grid_30',false)
var Settlement_Grid_30 = Settlement_Grid_30.mosaic()
var Settlement_Grid_30_v = Settlement_Grid_30.addBands(Settlement_Grid_30).reduceToVectors({
  reducer:ee.Reducer.first(),
  crs:'EPSG:4326',
  scale:1000,
  geometry:glob,
  maxPixels:1e12
})


Map.addLayer(Settlement_Grid_30_v,{color:'red'},'Settlement_Grid_30_v')
Export.table.toAsset(Settlement_Grid_30_v, 'Settlement_Grid_30_v_2020', 'projects/ee-modislst/assets/UrbanHeatIsland/Settlement_Grid_30_v_2020')

