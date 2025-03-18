library(dplyr)
library(ggpubr)
setwd("D:/pku/UES/UrbanHeatIsland/Data")

df_model4_raw_pars <- read.csv('./202501_allpixel/pars_quality_final_ava_model4_allpixel_watermask0.csv')
df_model4_watermask_pars <- read.csv('./202501_allpixel/pars_quality_final_ava_model4_allpixel_watermask2000.csv')

df_compare <- merge(df_model4_raw_pars,df_model4_watermask_pars[,c('ADM2CODE','model','estimate')],by=c('ADM2CODE','model'),how='inner')

df_compare['estimate_diff'] <- df_compare$estimate.x-df_compare$estimate.y
df_compare$estimate_diff_p <- (df_compare$estimate_diff/df_compare$estimate.x)*100

summary(df_compare$estimate_diff)
quantile(df_compare$estimate_diff,0.025)
quantile(df_compare$estimate_diff,0.975)

p1 <- ggplot(df_compare, aes(x = estimate_diff)) +
  geom_histogram(
    breaks = seq(-0.1, 0.2, length.out = 16),
    fill = "cornflowerblue", color = NA, alpha = 0.7
  ) +
  labs(title = "", x = expression(Delta~"Coefficient"), y = "Number of cities") +
  theme_minimal() +
  theme(
    panel.grid.major.x = element_blank(),
    panel.grid.minor.x = element_blank(),
    panel.grid.major.y = element_line(color = "gray", size = 0.5),
    panel.grid.minor.y = element_blank(),
    axis.ticks.x = element_line(color = "black"),
    axis.ticks.y = element_line(color = "black"),
  ) +
  scale_x_continuous(
    breaks = seq(-0.1, 0.2, by = 0.04)
  ) + 
  scale_y_continuous(
    breaks = seq(0,6000,by=1000)
  ) + 
  ylim(0,6000)

hist(df_compare$estimate_diff_p)
summary(df_compare$estimate_diff_p)

p2<-ggplot(df_compare, aes(x = estimate_diff_p)) +
  geom_histogram(
    breaks = seq(-100, 100, by = 10),
    fill = "cornflowerblue", color = NA, alpha = 0.7
  ) +
  labs(title = "", x = "Coefficient change (%)", y = "") +
  theme_minimal() +
  theme(
    panel.grid.major.x = element_blank(),
    panel.grid.minor.x = element_blank(),
    panel.grid.major.y = element_line(color = "gray", size = 0.5),
    panel.grid.minor.y = element_blank(),
    axis.ticks.x = element_line(color = "black"),
    axis.ticks.y = element_line(color = "black")
  ) +
  scale_x_continuous(
    breaks = seq(-100, 100, by = 20)
  ) + 
  scale_y_continuous(
    breaks = seq(0,6000,by=1000)
  ) +
  ylim(0,6000)

p <- ggarrange(p1,p2,ncol=2,labels = c('a','b'))
ggsave('./202501_allpixel/Figs/fig_s4.pdf',width=8,height=5,dpi=300)
ggsave('./202501_allpixel/Figs/fig_s4.png',width=8,height=5,dpi=300)
