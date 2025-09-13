pageObjectsConfig <- function(input) {
  list(
    reporting_rate = list(
      'Reporting Rate' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'reporting_rate_reporting_rate_1',
          'reporting_rate_reporting_rate_2'
        )
      )
    ),
    outlier_detection = list(
      'Outlier Detection' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'outlier_detection_outlier_detection_1',
          'outlier_detection_outlier_detection_2',
          'outlier_detection_outlier_detection_3',
          'outlier_detection_outlier_detection_4'
        )
      )
    ),
    consistency_checks = list(
      'ANC1 and Penta1' = list(
        parameters = list(),
        always_include = FALSE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Penta1 and Penta3' = list(
        parameters = list(),
        always_include = FALSE,
        single_entry = TRUE,
        prompts = list()
      ),
      'OPV1 and OPV3' = list(
        parameters = list(),
        always_include = FALSE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Custom Check' = list(
        parameters = list(
          x_axis = reactive({ input$x_axis }),
          y_axis = reactive({ input$y_axis })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list()
      )
    ),
    data_completeness = list(
      'Data Completeness' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'data_completeness_data_completeness_1',
          'data_completeness_data_completeness_2'
        )
      )
    ),
    ratios = list(
      'Ratio Plots' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list()
      )
    ),
    adjustment_changes = list(
      'Live Births' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Penta1' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('adjustment_changes_penta1_1')
      ),
      'BCG' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('adjustment_changes_bcg_1')
      ),
      'Measles 1' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('adjustment_changes_measles1_1')
      ),
      'Custom Check' = list(
        parameters = list(
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list('adjustment_changes_custom_check_1')
      )
    ),
    derived_coverage = list(
      'Penta 1' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Penta 3' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Measles 1' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list()
      ),
      'Custom' = list(
        parameters = list(input$indicator),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list()
      )
    ),
    denominator_assessment = list(
      'Total Population' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('denominator_assessment_total_population_1')
      ),
      'Births' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('denominator_assessment_births_1')
      )
    ),
    denominator_selection = list(
      'Denominator Selection' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list('denominator_selection_1')
      )
    ),
    national_coverage = list(
      'Measles 1' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'national_coverage_measles1_1',
          'national_coverage_measles1_2'
        )
      ),
      'Penta 3' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'national_coverage_penta3_1',
          'national_coverage_penta3_2'
        )
      ),
      'Penta1 to Penta3 Dropout' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'national_coverage_penta1_to_penta3_dropout_1',
          'national_coverage_penta1_to_penta3_dropout_2'
        )
      ),
      'Penta3 to Measles 1 Dropout' = list(
        parameters = list(),
        always_include = TRUE,
        single_entry = TRUE,
        prompts = list(
          'national_coverage_penta3_to_measles1_dropout_1',
          'national_coverage_penta3_to_measles1_dropout_2'
        )
      ),
      'Custom Checks' = list(
        parameters = list(
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list(
          'national_coverage_custom_checks_1',
          'national_coverage_custom_checks_2'
        )
      )
    ),
    subnational_coverage = list(
      'Measles 1' = list(
        parameters = list(
          admin_level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_measles1_1',
          'subnational_coverage_measles1_2'
        )
      ),
      'Penta 3' = list(
        parameters = list(
          admin_level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta3_1',
          'subnational_coverage_penta3_2'
        )
      ),
      'Penta1 to Penta3 Dropout' = list(
        parameters = list(
          admin_level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta1_to_penta3_dropout_1',
          'subnational_coverage_penta1_to_penta3_dropout_2'
        )
      ),
      'Penta3 to Measles 1 Dropout' = list(
        parameters = list(
          admin_level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta3_to_measles1_dropout_1',
          'subnational_coverage_penta3_to_measles1_dropout_2'
        )
      ),
      'Custom Checks' = list(
        parameters = list(
          admin_level = reactive({ input$admin_level }),
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_custom_checks_1',
          'subnational_coverage_custom_checks_2'
        )
      )
    ),
    subnational_inequality = list(
      'Measles 1' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_inequality_measles1_1',
          'subnational_inequality_measles1_2'
        )
      ),
      'Penta 3' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_inequality_penta3_1',
          'subnational_inequality_penta3_2'
        )
      ),
      'Penta1 to Penta3 Dropout' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_inequality_penta1_to_penta3_dropout_1',
          'subnational_inequality_penta1_to_penta3_dropout_2'
        )
      ),
      'Penta3 to Measles 1 Dropout' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_inequality_penta3_to_measles1_dropout_1',
          'subnational_inequality_penta3_to_measles1_dropout_2'
        )
      ),
      'Custom Checks' = list(
        parameters = list(
          level = reactive({ input$level }),
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list(
          'subnational_inequality_custom_checks_1',
          'subnational_inequality_custom_checks_2'
        )
      )
    ),
    subnational_mapping = list(
      'Measles 1' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_measles1_1',
          'subnational_coverage_measles1_2'
        )
      ),
      'Penta 3' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta3_1',
          'subnational_coverage_penta3_2'
        )
      ),
      'Penta1 to Penta3 Dropout' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta1_to_penta3_dropout_1',
          'subnational_coverage_penta1_to_penta3_dropout_2'
        )
      ),
      'Penta3 to Measles 1 Dropout' = list(
        parameters = list(
          level = reactive({ input$level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_penta3_to_measles1_dropout_1',
          'subnational_coverage_penta3_to_measles1_dropout_2'
        )
      ),
      'Custom Checks' = list(
        parameters = list(
          level = reactive({ input$level }),
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list(
          'subnational_coverage_custom_checks_1',
          'subnational_coverage_custom_checks_2'
        )
      )
    ),
    low_reporting = list(
      'Coverage' = list(
        parameters = list(
          level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
         'low_reporting_coverage_1',
         'low_reporting_coverage_2',
         'low_reporting_coverage_3'
        )
      ),
      'Dropout' = list(
        parameters = list(
          level = reactive({ input$admin_level })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'low_reporting_dropout_1',
          'low_reporting_dropout_2',
          'low_reporting_dropout_3'
        )
      )
    ),
    equity_assessment = list(
      'Measles 1' = list(
        parameters = list(
          type = reactive({ input$type })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'equity_assessment_measles1_1',
          'equity_assessment_measles1_2',
          'equity_assessment_measles1_3',
          'equity_assessment_measles1_4',
          'equity_assessment_measles1_5'
        )
      ),
      'Penta 3' = list(
        parameters = list(
          type = reactive({ input$type })
        ),
        always_include = TRUE,
        single_entry = FALSE,
        prompts = list(
          'equity_assessment_penta3_1',
          'equity_assessment_penta3_2',
          'equity_assessment_penta3_3',
          'equity_assessment_penta3_4',
          'equity_assessment_penta3_1'
        )
      ),
      'Custom Checks' = list(
        parameters = list(
          type = reactive({ input$type }),
          indicator = reactive({ input$indicator })
        ),
        always_include = FALSE,
        single_entry = FALSE,
        prompts = list(
          'equity_assessment_custom_checks_1',
          'equity_assessment_custom_checks_2',
          'equity_assessment_custom_checks_3',
          'equity_assessment_custom_checks_4',
          'equity_assessment_custom_checks_5'
        )
      )
    )
  )
}
