#!/bin/bash
for f in *.pdf; do
  mv "$f" "docs/references/"
done
