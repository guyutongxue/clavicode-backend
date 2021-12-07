PROGS=\
	bin/pause

all: $(PROGS)
.PHONY: all
.PHONY: clean

bin/%: src/%.c
	mkdir -p bin
	$(CC) -o $@ $<

clean:
	rm -f $(PROGS)
