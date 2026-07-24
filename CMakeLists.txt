cmake_minimum_required(VERSION 3.25)

project(ufdtd VERSION 0.1.0 LANGUAGES C)

include(CTest)

option(UFDTD_WARNINGS_AS_ERRORS "Treat project warnings as errors" OFF)

add_library(ufdtd_warnings INTERFACE)
if(CMAKE_C_COMPILER_ID STREQUAL "GNU")
  target_compile_options(
    ufdtd_warnings
    INTERFACE
      -Wall
      -Wextra
      -Wpedantic
      "$<$<CONFIG:Debug>:-O0>"
      "$<$<CONFIG:Debug>:-g3>"
  )
  if(UFDTD_WARNINGS_AS_ERRORS)
    target_compile_options(ufdtd_warnings INTERFACE -Werror)
  endif()
endif()

function(add_ufdtd_smoke target source)
  add_executable(${target} ${source})
  target_compile_features(${target} PRIVATE c_std_17)
  target_link_libraries(${target} PRIVATE ufdtd_warnings)
  add_test(NAME ${target} COMMAND ${target})
endfunction()

file(MAKE_DIRECTORY "${PROJECT_SOURCE_DIR}/output/smoke")

add_ufdtd_smoke(math_smoke examples/smoke/math_smoke.c)
add_ufdtd_smoke(memory_smoke examples/smoke/memory_smoke.c)

add_executable(signal_writer examples/smoke/signal_writer.c)
target_compile_features(signal_writer PRIVATE c_std_17)
target_link_libraries(signal_writer PRIVATE ufdtd_warnings)
add_test(
  NAME signal_writer
  COMMAND signal_writer "${PROJECT_SOURCE_DIR}/output/smoke/signal.csv"
)

set(THREADS_PREFER_PTHREAD_FLAG TRUE)
find_package(Threads REQUIRED)
add_ufdtd_smoke(pthread_smoke examples/smoke/pthread_smoke.c)
target_link_libraries(pthread_smoke PRIVATE Threads::Threads)

if(WIN32 AND DEFINED ENV{CONDA_PREFIX})
  set(_UFDTD_CONDA_LIBRARY "$ENV{CONDA_PREFIX}/Library")
  set(_UFDTD_MPI_HEADER "${_UFDTD_CONDA_LIBRARY}/include/mpi.h")
  set(_UFDTD_MPI_LIBRARY "${_UFDTD_CONDA_LIBRARY}/lib/msmpi.lib")
  set(_UFDTD_MPI_RUNTIME "${_UFDTD_CONDA_LIBRARY}/bin/mpiexec.exe")
  if(
    NOT EXISTS "${_UFDTD_MPI_HEADER}"
    OR NOT EXISTS "${_UFDTD_MPI_LIBRARY}"
    OR NOT EXISTS "${_UFDTD_MPI_RUNTIME}"
  )
    message(
      FATAL_ERROR
      "Conda MS-MPI is incomplete under $ENV{CONDA_PREFIX}.\n"
      "Header: ${_UFDTD_MPI_HEADER}\n"
      "Library: ${_UFDTD_MPI_LIBRARY}\n"
      "Runtime: ${_UFDTD_MPI_RUNTIME}"
    )
  endif()
  set(ENV{MSMPI_BIN} "${_UFDTD_CONDA_LIBRARY}/bin")
  set(ENV{MSMPI_INC} "${_UFDTD_CONDA_LIBRARY}/include")
  set(ENV{MSMPI_LIB64} "${_UFDTD_CONDA_LIBRARY}/lib")
  unset(_UFDTD_MPI_RUNTIME)
  unset(_UFDTD_MPI_LIBRARY)
  unset(_UFDTD_MPI_HEADER)
  unset(_UFDTD_CONDA_LIBRARY)
endif()

find_package(MPI REQUIRED COMPONENTS C)
add_executable(mpi_smoke examples/smoke/mpi_smoke.c)
target_compile_features(mpi_smoke PRIVATE c_std_17)
target_link_libraries(mpi_smoke PRIVATE ufdtd_warnings MPI::MPI_C)
add_test(
  NAME mpi_smoke
  COMMAND
    "${MPIEXEC_EXECUTABLE}"
    "${MPIEXEC_NUMPROC_FLAG}" "4"
    ${MPIEXEC_PREFLAGS}
    "$<TARGET_FILE:mpi_smoke>"
    ${MPIEXEC_POSTFLAGS}
)
set_tests_properties(mpi_smoke PROPERTIES TIMEOUT 30)

add_test(
  NAME mpi_wrong_process_count
  COMMAND
    "${CMAKE_COMMAND}"
    "-DMPIEXEC_EXECUTABLE=${MPIEXEC_EXECUTABLE}"
    "-DMPIEXEC_NUMPROC_FLAG=${MPIEXEC_NUMPROC_FLAG}"
    "-DMPI_PROGRAM=$<TARGET_FILE:mpi_smoke>"
    -P "${PROJECT_SOURCE_DIR}/cmake/CheckMpiWrongProcessCount.cmake"
)
set_tests_properties(
  mpi_wrong_process_count
  PROPERTIES
    TIMEOUT 30
)

add_executable(
  book_1d_bare_bones
  examples/ch03/book_1d_bare_bones.c
)
target_compile_features(book_1d_bare_bones PRIVATE c_std_17)
target_link_libraries(book_1d_bare_bones PRIVATE ufdtd_warnings m)
add_test(NAME book_1d_bare_bones COMMAND book_1d_bare_bones)
