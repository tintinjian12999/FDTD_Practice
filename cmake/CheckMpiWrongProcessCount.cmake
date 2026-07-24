execute_process(
  COMMAND
    "${MPIEXEC_EXECUTABLE}"
    "${MPIEXEC_NUMPROC_FLAG}" "5"
    "${MPI_PROGRAM}"
  RESULT_VARIABLE process_result
  OUTPUT_VARIABLE process_output
  ERROR_VARIABLE process_error
  TIMEOUT 25
)

if(process_result STREQUAL "0")
  message(FATAL_ERROR "MPI smoke unexpectedly accepted five processes.")
endif()

set(process_log "${process_output}${process_error}")
if(
  NOT process_log
    MATCHES "Skipping rank gather because 5 processes were started"
)
  message(FATAL_ERROR "MPI smoke did not report an early process-count exit.")
endif()
