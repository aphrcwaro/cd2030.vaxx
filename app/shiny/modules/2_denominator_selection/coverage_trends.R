coverageTrendsUI <- function(id, i18n) {
  ns <- NS(id)
  
  tabBox(
    title = i18n$t("title_population_trend"),
    width = 12,
    tabPanel(
      title = i18n$t("opt_penta1"),
      fluidRow(
        column(12, plotCustomOutput(ns('penta1'))),
        column(12, tagList(
          column(4, downloadButtonUI(ns('penta1_plot'))),
          column(4, downloadButtonUI(ns('penta1_data')))
        ))
      )
    ),
    
    tabPanel(
      title = i18n$t("opt_penta3"),
      fluidRow(
        column(12, plotCustomOutput(ns('penta3'))),
        column(12, tagList(
          column(4, downloadButtonUI(ns('penta3_plot'))),
          column(4, downloadButtonUI(ns('penta3_data')))
        ))
      )
    ),
    
    tabPanel(
      title = i18n$t("opt_measles"),
      fluidRow(
        column(12, plotCustomOutput(ns('measles1'))),
        column(12, tagList(
          column(4, downloadButtonUI(ns('measles1_plot'))),
          column(4, downloadButtonUI(ns('measles1_data')))
        ))
      )
    ),
    
    tabPanel(
      i18n$t("opt_custom_check"),
      fluidRow(
        column(3, indicatorSelect(ns('indicator'), i18n))
      ),
      fluidRow(
        column(12, plotCustomOutput(ns('custom'))),
        column(12, tagList(
          column(4, downloadButtonUI(ns('custom_plot'))),
          column(4, downloadButtonUI(ns('custom_data')))
        ))
      )
    )
  )
}

coverageTrendsServer <- function(id, cache, admin_level, region, i18n) {
  stopifnot(is.reactive(cache))
  stopifnot(is.reactive(admin_level))
  stopifnot(is.reactive(region))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      ns <- session$ns
      
      indicator <- indicatorSelectServer('indicator')

      survey_year <- reactive({
        req(cache())
        cache()$survey_year
      })

      populations <- reactive({
        req(cache(), cache()$check_inequality_params, admin_level())
        switch (
          admin_level(),
          national = cache()$indicator_coverage_national,
          adminlevel_1 = cache()$indicator_coverage_admin1,
          cache()$calculate_indicator_coverage(admin_level())
        )
      })

      penta1_data <- reactive({
        req(populations())
        calculate_derived_coverage(populations(), 'penta1')
      })

      penta3_data <- reactive({
        req(populations())
        calculate_derived_coverage(populations(), 'penta3')
      })

      measles1_data <- reactive({
        req(populations())
        calculate_derived_coverage(populations(), 'measles1')
      })

      custom_data <- reactive({
        req(populations(), indicator())
        calculate_derived_coverage(populations(), indicator = indicator())
      })

      output$region_ui <- renderUI({
        req(admin_level())
        if (admin_level() != 'national') {
          regionInputUI(ns('region'), i18n)
        }
      })

      output$penta1 <- renderCustomPlot({
        req(penta1_data())
        if (admin_level() != 'national') {
          req(region())
        }
        plot(penta1_data(), region = region())
      })

      output$penta3 <- renderCustomPlot({
        req(penta3_data())
        if (admin_level() != 'national') req(region())
        plot(penta3_data(), region = region())
      })

      output$measles1 <- renderCustomPlot({
        req(measles1_data())
        if (admin_level() != 'national') req(region())
        plot(measles1_data(), region = region())
      })

      output$custom <- renderCustomPlot({
        req(custom_data())
        if (admin_level() != 'national') req(region())
        plot(custom_data(), region = region())
      })

      downloadPlot(
        id = 'penta1_plot',
        filename = reactive('penta1_derived_coverage'),
        data = penta1_data,
        i18n = i18n,
        plot_function = function() plot(penta1_data(), region = region())
      )

      downloadExcel(
        id = 'penta1_data',
        filename = reactive('penta1_derived_coverage'),
        data = penta1_data,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t('sheet_penta1_derived_coverage')
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, data, startCol = 1, startRow = 1)
        }
      )

      downloadPlot(
        id = 'penta3_plot',
        filename = reactive('penta3_derived_coverage'),
        data = penta3_data,
        i18n = i18n,
        plot_function = function() plot(penta3_data(), region = region())
      )

      downloadExcel(
        id = 'penta3_data',
        filename = reactive('penta3_derived_coverage'),
        data = penta3_data,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t('sheet_penta3_derived_coverage')
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, data, startCol = 1, startRow = 1)
        }
      )

      downloadPlot(
        id = 'measles1_plot',
        filename = reactive('measles1_derived_coverage'),
        data = measles1_data,
        i18n = i18n,
        plot_function = function() plot(measles1_data(), region = region())
      )

      downloadExcel(
        id = 'measles1_data',
        filename = reactive('measles1_derived_coverage'),
        data = measles1_data,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- i18n$t('sheet_measles1_derived_coverage')
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, data, startCol = 1, startRow = 1)
        }
      )

      downloadPlot(
        id = 'custom_plot',
        filename = reactive(paste0(indicator(), '_derived_coverage')),
        data = custom_data,
        i18n = i18n,
        plot_function = function() plot(custom_data(), region = region())
      )

      downloadExcel(
        id = 'custom_data',
        filename = reactive(paste0(indicator(), '_derived_coverage')),
        data = custom_data,
        i18n = i18n,
        excel_write_function = function(wb, data) {
          sheet_name_1 <- str_glue_data(list(indicator = indicator()), i18n$t('sheet_custom_derived_coverage'))
          addWorksheet(wb, sheet_name_1)
          writeData(wb, sheet = sheet_name_1, data, startCol = 1, startRow = 1)
        }
      )

      countdownHeaderServer(
        'derived_coverage',
        cache = cache,
        path = 'denominator-assessment',
        section = 'sec-derived-coverage',
        i18n = i18n
      )
    }
  )
}
