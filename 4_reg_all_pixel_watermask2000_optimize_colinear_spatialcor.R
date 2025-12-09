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
library(ggpubr)
library(hdf5r)
library(data.table)

# cl<-makeCluster(8)
# registerDoParallel(cl)

setwd("l:/baihao/UHI/2025/all_pixel_watermask2000")
output <- "./figs_full"
log_path <- "log.txt"

mat.name=paste("all_pixel_watermask2000",".mat",sep="")
pixel_m <- H5File$new(mat.name, mode = "r")
pixel_data <- pixel_m[["./combined_matrix"]]$read()
pixel_data <- as.data.frame(pixel_data)

colnames(pixel_data) <- c("LST_Day", "LST_Night", "tree_canopy_cover", 
                          "vegetation_cover", "NDVI", "EVI", "albedo", 
                          "built_height", "building_count", "Building_height_variance", 
                          "srtm_dem", "merit_dem", "f_bio", "f_fossil", 
                          "f_metals", "f_minerals","ADM2_CODE")

pixel_data_f <- pixel_data %>%
  filter(if_all(everything(), ~ .x != -999 & is.finite(.x))) %>%
  filter(vegetation_cover > 0, NDVI > 0)

pixel_data_f <- setDT(pixel_data_f)
rm(pixel_data)
#run for cities with urban core area only
df_urban_stat <- read.csv('../Urban_stat_lst_vc.csv')
ADM2_CODE_list <- df_urban_stat %>% 
  filter(urban_area > 0) %>% 
  select(ADM2_CODE)

ADM2_CODE_list <- unique(ADM2_CODE_list)

get_model_rrp <- function(m){
  
  #model statistics
  m_rmse <- sqrt(mean(m$residuals^2))
  m_r2 <- summary(m)$r.squared
  m_p_value <- as.double(glance(m)$p.value)
  
  m_num_coef <- length(m$coefficients)
  if (m_num_coef <= 2) {
    m_vif_max <- 0
  }else{
    m_vif_max <- max(vif(m))
  }
  m_info <- c(m_rmse,m_r2,m_p_value,m_vif_max)
  
  return(m_info)
}

get_model_pars <- function(m){
  
  #model parameters statistics
  m_coef <- coef(m)
  m_coef_p <- summary(m)$coefficients[, "Pr(>|t|)"]
  m_coefint <- as.data.frame(confint(m))
  m_coefint$estimate <- m_coef
  m_coefint$p_value <- m_coef_p
  m_coefint$coefs <- rownames(m_coefint)
  
  m_pars <- pivot_longer(m_coefint,cols = 1:4,names_to = 'pars')
  
  return(m_pars)
}

draw_scat <- function(data,x,y){
  p_slope <- ggplot(data,aes_string(x=x,y=y))+
    geom_point()+
    stat_poly_eq(aes(label = paste(..eq.label.., ..rr.label.., sep = "~~~")),
                 formula = y ~ x, parse = TRUE)+
    stat_poly_line()+
    theme_bw()
  return(p_slope)
}

#regression
log <- list()
pass_list <- list()
result_all_list <- list()
result_pars_list <- list()

# ADM2_CODE_list
which(ADM2_CODE_list == 3954)

for (i in 1:dim(ADM2_CODE_list)) { #nrow(df)
  adm2 <- ADM2_CODE_list[i,1]
  cat(adm2, "\n")
  #parameters
  pixel_data_adm2 <- pixel_data_f[ADM2_CODE==adm2]
  adm2_rows <- nrow(pixel_data_adm2)
  
  if (is.null(adm2_rows) || adm2_rows < 20) {
    pass_list[[i]] <- paste("Invalid data for", adm2, "/n")
    next
  }
  
  #parameters_unpacked_filtered$Percent_Vegetation = parameters_unpacked_filtered$Percent_Tree_Cover + parameters_unpacked_filtered$Percent_NonTree_Vegetation
  #scale factor
  pixel_data_adm2[,c("LST_Day","LST_Night")] = pixel_data_adm2[,c("LST_Day","LST_Night")]*0.02
  
  model.list <- list(
    model2_day = lm(LST_Day ~ albedo + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                    data = pixel_data_adm2),
    model3_day = lm(LST_Day ~ tree_canopy_cover + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                    data = pixel_data_adm2),
    model4_day = lm(LST_Day ~ vegetation_cover + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals, 
                    data = pixel_data_adm2),
    model5_day = lm(LST_Day ~ NDVI + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                    data = pixel_data_adm2),
    model2_night = lm(LST_Night ~ albedo + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                      data = pixel_data_adm2),
    model3_night = lm(LST_Night ~ tree_canopy_cover + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                      data = pixel_data_adm2),
    model4_night = lm(LST_Night ~ vegetation_cover + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals, 
                      data = pixel_data_adm2),
    model5_night = lm(LST_Night ~ NDVI + built_height + building_count + srtm_dem + Building_height_variance + f_bio + f_fossil + f_metals,
                      data = pixel_data_adm2)
  )
  
  model_step <- lapply(model.list,step,trace=F,direction = 'both')
  
  model_result <- sapply(model_step,get_model_rrp)
  models_rr <- as.data.frame(model_result)
  models_rr$metrics <- c('rmse','r2','p_value','vif')
  
  models_pars <- lapply(model_step,get_model_pars)
  
  named_tibbles <- lapply(names(models_pars), function(name) {
    tibble::add_column(models_pars[[name]], model = name, .before = 1)
  })
  
  models_pars2 <- bind_rows(named_tibbles)
  
  models_rr$ADM2CODE <- adm2
 
  models_pars2$ADM2CODE <- adm2
  
  result_all_list[[i]] <- models_rr
  result_pars_list[[i]] <- models_pars2
}

result_all <- do.call(rbind, result_all_list)
result_pars <- do.call(rbind, result_pars_list)


if (!dir.exists('./all_model_results')) {
  dir.create('./all_model_results')
}
#save
write_lines(pass_list,'./all_model_results/pass_list_allpixel_watermask2000_vif.txt')
write_csv(result_all,'./all_model_results/result_all_allpixel_watermask2000_vif.csv')
write_csv(result_pars,'./all_model_results/result_pars_allpixel_watermask2000_vif.csv')


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

result_stat$label <- Map(function(r2_n) bquote(R^2 ~ "> 0.7" ~ "=" ~ .(r2_n)), result_stat$r2_n)
result_all_l$model <- factor(result_all_l$model,levels = c("model4_day","model4_night","model3_day","model3_night","model5_day","model5_night","model2_day","model2_night"))
result_stat$model <- factor(result_stat$model,levels = c("model4_day","model4_night","model3_day","model3_night","model5_day","model5_night","model2_day","model2_night"))

p1 <- ggplot(data=result_all_l,aes(x=r2,group=model,fill=model))+
  geom_histogram(binwidth=0.1,color="black",alpha = 0.7,na.rm=F)+
  geom_vline(data = result_stat,aes(xintercept=mean_r2),color = "#ec2F4B", linetype = "dashed",linewidth = 0.8)+
  geom_vline(xintercept=0.7,color = "#ec2F4B",linewidth = 0.8)+
  geom_text(data = result_stat,aes(label=label),x=0.8,y=10000,size = 3.5,parse = T)+
  facet_wrap(~ model, ncol = 2, scales = "fixed",
             labeller = labeller(model = c("model2_day"='Model (Albedo) Day',
                                           "model3_day"='Model (Tree Cover) Day',
                                           "model4_day"='Model (Vegetation Cover) Day',
                                           "model5_day"='Model (NDVI) Day',
                                           "model2_night"='Model (Albedo) Night',
                                           "model3_night"='Model (Tree Cover) Night',
                                           "model4_night"='Model (Vegetation Cover) Night',
                                           "model5_night"='Model (NDVI) Night')))+
  theme_bw()+
  scale_fill_manual(values = c("model2_day"='orange',
                               "model3_day"='orange',
                               "model4_day"='orange',
                               "model5_day"='orange',
                               "model2_night"='cornflowerblue',
                               "model3_night"='cornflowerblue',
                               "model4_night"='cornflowerblue',
                               "model5_night"='cornflowerblue'))+
  scale_x_continuous(breaks = seq(0, 1, by = 0.2))+
  scale_y_continuous(expand = c(0, 0), limits = c(0, 12000))+
  labs(x = expression(Model~R^{2}), y = "Number of cities")+ #"R² Values"
  guides(fill="none")

##v2
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

p1 <- ggplot(data = result_all_l_grid, aes(x = r2, group = model, fill = time)) +  # 使用 'time' 作为 fill
  geom_histogram(binwidth = 0.1, color = "black", alpha = 0.7, na.rm = F) +
  geom_vline(data = result_stat_grid, aes(xintercept = mean_r2), color = "#ec2F4B", linetype = "dashed", linewidth = 0.8) +
  geom_vline(xintercept = 0.7, color = "#ec2F4B", linewidth = 0.8) +
  geom_text(data = result_stat_grid, aes(label = label, x = 0.7, y = 9000), size = 3.5, parse = T, vjust = -0.5) +  # 调整文本位置
  facet_grid(model~time, scales = "fixed",  # 使用 facet_grid 以在行上显示 'time'，列上显示 'model'
             labeller = labeller(model = c("model2" = 'Model\n(Albedo)',
                                           "model3" = 'Model\n(Tree cover)',
                                           "model4" = 'Model\n(Vegetation cover)',
                                           "model5" = 'Model\n(NDVI)'),
                                 time = c('day' = 'Day',
                                          'night' = 'Night'))) +
  theme_bw() +
  scale_fill_manual(values = c("day" = 'orange', "night" = 'cornflowerblue')) +  # 根据 time 填充颜色
  scale_x_continuous(breaks = seq(0, 1, by = 0.2)) +
  scale_y_continuous(expand = c(0, 0), limits = c(0, 12000)) +
  labs(x = expression(Model~R^{2}), y = "Number of cities") +  # 添加标签
  guides(fill = "none")+
  theme(panel.spacing = unit(0.5, "cm"))


ggsave('./figs/figs4_watermask2000.jpg',p1,dpi = 300, height = 7, width = 5)
ggsave('./figs/figs4_watermask2000.pdf',p1,dpi = 300, height = 7, width = 5)

result_pars_filtered <- result_pars %>%
  pivot_wider(names_from = pars,values_from = value) %>%
  rename(par_p_value = p_value) %>% 
  inner_join(result_all_filtered[,c("CODE2", "model",'rmse','r2','p_value')], by = c("CODE2", "model")) %>%
  filter(coefs %in% c('vegetation_cover','tree_canopy_cover','NDVI','albedo')) %>%
  filter(par_p_value < 0.01,estimate < 0)

result_pars_filtered_stat <- result_pars_filtered %>%
  group_by(model) %>%
  summarise(mean_r2 = mean(r2),
            filtered_n = n())