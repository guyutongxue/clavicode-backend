PROGS=\
	bin/pause\
	bin/sleep_n_rm

all: $(PROGS)
.PHONY: all
.PHONY: clean

bin/%: src/%.c
	mkdir -p bin
	$(CC) -o $@ $<

clean:
	rm -f $(PROGS)
