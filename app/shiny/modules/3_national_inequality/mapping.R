subnationalMappingUI <- function(id, i18n) {
  ns <- NS(id)
  
  tabBox(
    title = i18n$t('title_subnational_mapping'),
    width = 12,
    
    tabPanel(title = i18n$t("opt_penta3"), downloadCoverageUI(ns('penta3'))),
    tabPanel(title = i18n$t("opt_mcv1"), downloadCoverageUI(ns('measles1'))),
    tabPanel(title = i18n$t("title_penta13_dropout"), downloadCoverageUI(ns('dropout_penta13'))),
    tabPanel(title = i18n$t("title_penta3_mcv1_dropout"), downloadCoverageUI(ns('dropout_penta3mcv1'))),
    tabPanel(
      title = i18n$t("opt_custom_check"),
      fluidRow(
        column(3, indicatorSelect(ns('indicator'), i18n, indicators = get_analysis_indicators()))
      ),
      downloadCoverageUI(ns('custom'))
    )
  )
}

subnationalMappingServer <- function(id, cache, palette, i18n) {
  stopifnot(is.reactive(cache))
  stopifnot(is.reactive(palette))

  moduleServer(
    id = id,
    module = function(input, output, session) {
      
      indicator <- indicatorSelectServer('indicator')
      
      mapping_dt <- reactive({
        req(cache(), cache()$check_inequality_params)
        cache()$get_mapping_data('adminlevel_1')
      })

      years <- reactive({
        req(cache())
        cache()$mapping_years
      })

      penta3_mapping <- reactive({
        req(mapping_dt(), palette())
        mapping_dt() %>%
          filter_mapping_data('penta3', denominator = cache()$get_denominator('penta3'),
                              palette = palette(), plot_year = years())
      })

      measles1_mapping <- reactive({
        req(mapping_dt(), palette())
        mapping_dt() %>%
          filter_mapping_data('measles1', denominator = cache()$get_denominator('measles1'),
                              palette = palette(), plot_year = years())
      })
      
      dropout_penta13_mapping <- reactive({
        req(mapping_dt(), palette())
        mapping_dt() %>%
          filter_mapping_data('dropout_penta13', denominator = cache()$get_denominator('dropout_penta13'),
                              palette = palette(), plot_year = years())
      })
      
      dropout_penta3mcv1_mapping <- reactive({
        req(mapping_dt(), palette())
        mapping_dt() %>%
          filter_mapping_data('dropout_penta3mcv1', denominator = cache()$get_denominator('dropout_penta3mcv1'),
                              palette = palette(), plot_year = years())
      })

      custom_mapping <- reactive({
        req(mapping_dt(), palette(), indicator())
        mapping_dt() %>%
          filter_mapping_data(indicator(), denominator = cache()$get_denominator(indicator()),
                              palette = palette(), plot_year = years())
      })

      downloadCoverageServer(
        id = 'penta3',
        filename = reactive(paste0('penta3_adminlevel_1_map_', cache()$get_denominator('penta3'))),
        data_fn = penta3_mapping,
        sheet_name = reactive(i18n$t("title_penta3")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'measles1',
        filename = reactive(paste0('measles1_adminlevel_1_map_', cache()$get_denominator('measles1'))),
        data_fn = measles1_mapping,
        sheet_name = reactive(i18n$t("title_measles1")),
        i18n = i18n
      )
      
      downloadCoverageServer(
        id = 'dropout_penta13',
        filename = reactive(paste0('dropout_penta13_survey_', cache()$get_denominator('dropout_penta13'))),
        data_fn = dropout_penta13_mapping,
        sheet_name = reactive(i18n$t("title_penta13_dropout")),
        i18n = i18n
      )
      
      downloadCoverageServer(
        id = 'dropout_penta3mcv1',
        filename = reactive(paste0('dropout_penta3mcv1_survey_', cache()$get_denominator('dropout_penta3mcv1'))),
        data_fn = dropout_penta3mcv1_mapping,
        sheet_name = reactive(i18n$t("title_penta3_mcv1_dropout")),
        i18n = i18n
      )

      downloadCoverageServer(
        id = 'custom',
        filename = reactive(paste0(indicator(), '_adminlevel_1_map_', cache()$get_denominator(indicator()))),
        data_fn = custom_mapping,
        sheet_name = reactive(paste(indicator(), i18n$t("title_coverage"))),
        i18n = i18n
      )
    }
  )
}
