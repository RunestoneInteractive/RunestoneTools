# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
from __future__ import print_function

__author__ = 'danschellenberg'

from docutils import nodes
from docutils.parsers.rst import directives
from runestone.server.componentdb import engine, meta
from runestone.common.runestonedirective import RunestoneIdDirective, RunestoneNode

def setup(app):
    app.add_directive('p5', P5)

    app.add_javascript('p5-widget.js')  #using a locally saved version
    # app.add_javascript('//toolness.github.io/p5.js-widget/p5-widget.js')  #using an online version

    app.add_stylesheet('p5.css')

    app.add_node(P5Node, html=(visit_p5_node, depart_p5_node))

    app.connect('doctree-resolved',process_p5_nodes)
    app.connect('env-purge-doc', purge_p5)


TEMPLATE = """
<div class="embedded_p5">
<script type="text/p5" id="%(divid)s" %(autoplay)s data-height="%(height)s" data-preview-width="%(width)s">
%(p5content)s
</script>
</div>
"""

class P5Node(nodes.General, nodes.Element, RunestoneNode):
    def __init__(self,content, **kwargs):
        """
        Arguments:
        - `self`:
        - `content`:
        """
        super(P5Node,self).__init__(**kwargs)
        self.p5_content = content

# self for these functions is an instance of the writer class.  For example
# in html, self is sphinx.writers.html.SmartyPantsHTMLTranslator
# The node that is passed as a parameter is an instance of our node class.
def visit_p5_node(self,node):
    res = TEMPLATE
    res = res % node.p5_content

    res = res.replace("u'","'")  # hack:  there must be a better way to include the list and avoid unicode strings

    self.body.append(res)

def depart_p5_node(self,node):
    ''' This is called at the start of processing an datafile node.  If datafile had recursive nodes
        etc and did not want to do all of the processing in visit_ac_node any finishing touches could be
        added here.
    '''
    pass


def process_p5_nodes(app,env,docname):
    pass


def purge_p5(app,env,docname):
    pass


class P5(RunestoneIdDirective):
    """
.. p5:: identifier
   :autoplay: If present, the sketch will start playing automatically
   :height: height of widget and preview--default is 300
   :width: width of sketch preview--default is 150
   """
    required_arguments = 1
    optional_arguments = 3
    has_content = True
    option_spec = RunestoneIdDirective.option_spec.copy()
    option_spec.update({
        'autoplay':directives.flag,
        'height':directives.positive_int,
        'width':directives.positive_int
    })

    def run(self):
        """
            process the p5 directive and generate html for output.
            :param self:
            :return:
            .. p5:: identifier
               :autoplay: If present, the sketch will start playing automatically
               :height: height of widget and preview--default is 300
               :width: width of sketch preview--default is 150
        """
        super(P5, self).run()
        env = self.state.document.settings.env

        if 'height' in self.options:
            self.options['height'] = self.options['height']
        else:
            self.options['height'] = 300
        if 'width' in self.options:
            self.options['width'] = self.options['width']
        else:
            self.options['width'] = 150

        if self.content:
            source = "\n".join(self.content)+"\n"
        else:
            source = '\n'
        self.options['p5content'] = source

        if 'autoplay' in self.options:
            self.options['autoplay'] = 'data-autoplay'
        else:
            self.options['autoplay'] = ''

        p5_node = P5Node(self.options, rawsource=self.block_text)
        p5_node.source, p5_node.line = self.state_machine.get_source_and_line(self.lineno)
        return [p5_node]
