function findHeaderRowIndex(matrix) {

  const knownHeaders = new Set(
    Object.values(HEADER_ALIASES)
      .flat()
      .map(normalizeHeader)
  );

  let bestIndex = -1;
  let bestScore = 0;

  const maxRows = Math.min(
    matrix.length,
    30
  );

  for (
    let rowIndex = 0;
    rowIndex < maxRows;
    rowIndex += 1
  ) {

    const row =
      Array.isArray(matrix[rowIndex])
        ? matrix[rowIndex]
        : [];

    let score = 0;

    for (
      const cell of row
    ) {

      const header =
        normalizeHeader(cell);

      if (
        header &&
        knownHeaders.has(header)
      ) {
        score += 1;
      }

    }

    if (
      score > bestScore
    ) {

      bestScore = score;
      bestIndex = rowIndex;

    }

  }

  return bestScore >= 3
    ? bestIndex
    : -1;
}
