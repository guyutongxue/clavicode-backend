PROGS=\
	bin/pause\
	bin/sleep_n_rm

all: $(PROGS)
.PHONY: all
.PHONY: clean

bin/%: src/%.c
	$(CC) -o $@ $<

clean:
	rm -f $(PROGS)
