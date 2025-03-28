library(readr)
library(tidyr)
library(dplyr)
library(stats)
library(tidyverse)
library(ggplot2)
library(broom)
library(caret)
library(ggpmisc)
library(car)
# library(foreach)
# library(doParallel)
library(ggpubr)

#filter model4 result

setwd("D:/pku/UES/UrbanHeatIsland/Data/202501_allpixel")

#read 
file_all <- './all_model_results/result_all_allpixel_watermask0.csv'
file_pars <- './all_model_results/result_pars_allpixel_watermask0.csv'
result_all <- read.csv(file_all)
result_pars <- read.csv(file_pars)

#quality check
result_all_l <- result_all %>% 
  pivot_longer(cols = 1:8,
               names_to = 'model',
               values_to = 'value') %>%
  pivot_wider(names_from = metrics,values_from = value)

result_stat <- result_all_l %>%
  group_by(model) %>%
  summarise(mean_r2 = mean(r2),
            r2_n = sum(r2>0.7),
            mean_rmse = mean(rmse),
            rmse_n = sum(rmse<2))

result_all_filtered <- result_all_l %>%
  filter(r2>0.7,p_value<0.01,rmse<2)

result_all_filtered_stat <- result_all_filtered %>%
  group_by(model) %>%
  summarise(filtered_n = n())

result_all_l_grid <- result_all_l %>%
  separate(model, into = c("model", "time"), sep = "_")

result_stat_grid <- result_all_l_grid %>%
  group_by(model,time) %>%
  summarise(mean_r2 = mean(r2),
            r2_n = sum(r2>0.7),
            mean_rmse = mean(rmse),
            rmse_n = sum(rmse<2),.groups = "drop")

result_stat_grid$label <- Map(function(r2_n) bquote(R^2 ~ "> 0.7" ~ "=" ~ .(r2_n)), result_stat_grid$r2_n)
result_all_l_grid$model <- factor(result_all_l_grid$model,levels = c("model4","model3","model5","model2"))
result_stat_grid$model <- factor(result_stat_grid$model,levels = c("model4","model3","model5","model2"))

p1 <- ggplot(data = result_all_l_grid, aes(x = r2, group = model, fill = time)) +
  geom_histogram(binwidth = 0.1, color = "black", alpha = 0.7, na.rm = F) +
  geom_vline(data = result_stat_grid, aes(xintercept = mean_r2), color = "#ec2F4B", linetype = "dashed", linewidth = 0.8) +
  geom_vline(xintercept = 0.7, color = "#ec2F4B", linewidth = 0.8) +
  geom_text(data = result_stat_grid, aes(label = label, x = 0.7, y = 9000), size = 3.5, parse = T, vjust = -0.5) +
  facet_grid(model~time, scales = "fixed",
             labeller = labeller(model = c("model2" = 'Model\n(Albedo)',
                                           "model3" = 'Model\n(Tree cover)',
                                           "model4" = 'Model\n(Vegetation cover)',
                                           "model5" = 'Model\n(NDVI)'),
                                 time = c('day' = 'Day',
                                          'night' = 'Night'))) +
  theme_bw() +
  scale_fill_manual(values = c("day" = 'orange', "night" = 'cornflowerblue')) +
  scale_x_continuous(breaks = seq(0, 1, by = 0.2)) +
  scale_y_continuous(expand = c(0, 0), limits = c(0, 12000)) +
  labs(x = expression(Model~R^{2}), y = "Number of cities") +
  guides(fill = "none")+
  theme(panel.spacing = unit(0.5, "cm"))

ggsave('./Figs/figs4_watermask2000.jpg',p1,dpi = 300, height = 7, width = 5)
ggsave('./Figs/figs4_watermask2000.pdf',p1,dpi = 300, height = 7, width = 5)

result_pars_filtered <- result_pars %>%
  pivot_wider(names_from = pars,values_from = value) %>%
  rename(par_p_value = p_value) %>% 
  inner_join(result_all_filtered[,c("ADM2CODE", "model",'rmse','r2','p_value')], by = c("ADM2CODE", "model")) %>%
  filter(coefs %in% c('vegetation_cover','tree_canopy_cover','NDVI','albedo')) %>%
  filter(par_p_value < 0.01,estimate < 0)

result_pars_filtered_stat <- result_pars_filtered %>%
  group_by(model) %>%
  summarise(mean_r2 = mean(r2),
            filtered_n = n())

# result_pars_filtered <- result_pars_filtered%>%
#   mutate(value = ifelse(coefs == 'NDVI', estimate * 100, estimate))

#filter final parameters for estimation
pars_quality_final <- result_pars_filtered

if (str_detect(file_pars,'allpixel')) {
  global_cities <- read.csv("D:/pku/UES/UrbanHeatIsland/cities/Global_Cities3.csv")
  pars_quality_final <- merge(pars_quality_final,global_cities[,c('ADM0_CODE','ADM0_NAME','ADM2_CODE')],by.x='ADM2CODE',by.y = 'ADM2_CODE')
  pars_quality_final_CODE3 <- as.data.frame(unique(pars_quality_final$ADM0_NAME))
  colnames(pars_quality_final_CODE3) <- 'ADM0_NAME'
}else{
  pars_quality_final_CODE3 <- as.data.frame(unique(pars_quality_final$ADM0))
  colnames(pars_quality_final_CODE3) <- 'ADM0_NAME'
}

iso_code <- read.csv("D:/pku/UES/UrbanHeatIsland/cities/Global_Cities3_isoCODE.csv")

pars_quality_final_CODE3_iso <- pars_quality_final_CODE3 %>% 
  left_join(iso_code[,c("ADM0_NAME","ISOCODE")],by = join_by(ADM0_NAME == ADM0_NAME))

#remove iso code without roofs
GLOBAL_ROOF_ISO3 <- read.csv("D:/pku/UES/UrbanHeatIsland/Data/GLOBAL_ROOF_AVALIABLE_ISO3.csv")
pars_quality_final_CODE3_iso_ava <- pars_quality_final_CODE3_iso %>% 
  filter(ISOCODE %in% GLOBAL_ROOF_ISO3$ISOCODE)

# write_csv(pars_quality_final_CODE3_iso_ava,'pars_quality_final_CODE3.csv')

pars_quality_final_ava <- pars_quality_final %>% 
  filter(ADM0_NAME %in% pars_quality_final_CODE3_iso_ava$ADM0_NAME) %>% 
  left_join(iso_code[,c("ADM0_NAME","ISOCODE")],by = join_by(ADM0_NAME == ADM0_NAME))

# write_csv(pars_quality_final_ava,'pars_quality_final_ava.csv')

#check city numbers
pars_quality_final_ava_stat <- pars_quality_final_ava %>% 
  filter(str_detect(model,"model4")) %>%
  group_by(model) %>% 
  summarise(quality_n = n())

pars_quality_final_ava_stat_paired <- pars_quality_final_ava %>%
  filter(str_detect(model,"model4")) %>%
  group_by(ADM2CODE) %>% 
  summarise(quality_n = n()) %>%
  filter(quality_n >1) %>%
  summarise(paired_city =n())

pars_quality_final_ava_model4 <- pars_quality_final_ava %>% 
  filter(str_detect(model,"model4"))

write_csv(pars_quality_final_ava_model4,'pars_quality_final_ava_model4_allpixel_watermask2000.csv')
