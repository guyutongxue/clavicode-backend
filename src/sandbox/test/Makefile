PROGS=\
	_echo\
	_helloworld\
	_read\
	_write\
	_system\
	_sleep\
	_chat\

CXX_FLAGS=\
	-g -static\

all: $(PROGS)
.PHONY: all
.PHONY: clean

_%: %.cpp
	g++ -o $@ $< $(CXX_FLAGS)

clean:
	rm -f $(PROGS)
